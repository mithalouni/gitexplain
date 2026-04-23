# Implementation Plan: GitExplain

## Overview

GitExplain is a local-first narrated lesson generation system consisting of an MCP server, web server, and browser-based player. Implementation is organized into 5 milestones for incremental delivery:

- **M1**: MCP server skeleton + one end-to-end slide type
- **M2**: All 20 slide templates rendered in the player
- **M3**: ElevenLabs TTS integration + audio caching
- **M4**: Repo scanner + lesson generator logic
- **M5**: Landing page install flows + polish

## Tasks

### Milestone 1: MCP Server Skeleton + End-to-End Flow

- [x] 1. Set up MCP server infrastructure
  - [x] 1.1 Create MCP server entry point with stdio transport
    - Implement `mcp/src/index.ts` with MCP SDK stdio transport
    - Export `create_lesson` tool with title and slides parameters
    - Export `slide_types_guide` prompt with schema documentation
    - Include SERVER_INSTRUCTIONS constant with usage guidelines
    - _Requirements: 1.1, 1.2, 1.3, 1.6, 3.1, 14.1, 14.2, 14.4, 14.5_
  
  - [x]* 1.2 Write property test for MCP tool schema validation
    - **Property 2: Valid Lessons Pass Validation**
    - **Validates: Requirements 3.2, 11.1, 11.2, 11.3**
    - Test that valid lesson objects pass validation
    - Use fast-check to generate random valid lessons
    - _Requirements: 3.2, 11.1, 11.2, 11.3_
  
  - [x] 1.3 Implement Web server process lifecycle management
    - Add `startServer()` function to spawn server.js with PORT=0
    - Parse stdout for "http://localhost:{port}" to extract base URL
    - Implement 8-second timeout with error handling
    - Add shutdown handlers for SIGINT/SIGTERM
    - _Requirements: 1.4, 1.5, 16.3, 16.4, 16.5, 16.6_
  
  - [x]* 1.4 Write unit tests for process lifecycle
    - Test server spawning and port extraction
    - Test shutdown signal handling
    - Test startup timeout error
    - _Requirements: 16.3, 16.4, 16.5, 16.6_

- [x] 2. Implement Web server core with basic validation
  - [x] 2.1 Create Express server with in-memory storage
    - Set up Express app with JSON body parser
    - Create `lessons` Map for in-memory storage
    - Implement POST /api/lessons endpoint with ID generation
    - Implement GET /api/lessons/:id endpoint
    - Bind to PORT environment variable or default 4178
    - _Requirements: 3.3, 3.4, 9.4, 16.1, 16.2, 17.4_
  
  - [x] 2.2 Implement lesson validation logic
    - Create `validateLesson()` function checking title, slides array
    - Validate slide count (1-20 slides)
    - Validate each slide has type, narration, data fields
    - Validate narration length (max 500 chars)
    - Return descriptive error strings with slide index
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_
  
  - [x]* 2.3 Write property test for invalid lesson rejection
    - **Property 3: Invalid Lessons Fail Validation**
    - **Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5**
    - Test that invalid lessons are rejected with error messages
    - Generate random invalid lessons (missing fields, wrong types)
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_
  
  - [x]* 2.4 Write property test for lesson ID uniqueness
    - **Property 8: Lesson ID Uniqueness**
    - **Validates: Requirements 3.3**
    - Test that 1000 sequential lesson creations produce unique IDs
    - _Requirements: 3.3_

- [x] 3. Implement basic player with title slide support
  - [x] 3.1 Create player HTML structure and CSS
    - Create `public/player.html` with start screen and stage
    - Create `public/player.css` with dark pixel-art aesthetic
    - Add controls (play/pause, prev/next, restart, captions)
    - Add progress bar and slide counter
    - _Requirements: 5.1, 12.3_
  
  - [x] 3.2 Implement player JavaScript core
    - Create `public/player.js` with lesson fetching logic
    - Implement state machine (LOADING → READY → PLAYING → PAUSED)
    - Add keyboard shortcuts (Space, arrows, R, C, Esc)
    - Implement slide navigation (next/prev)
    - _Requirements: 5.1, 5.4, 5.7_
  
  - [x] 3.3 Implement title slide renderer
    - Create renderer registry pattern with RENDERERS object
    - Implement title slide renderer with title and subtitle
    - Add HTML escaping function for XSS prevention
    - Update stage innerHTML on slide change
    - _Requirements: 10.1, 10.5_
  
  - [x]* 3.4 Write unit tests for player rendering
    - Test title slide renderer output
    - Test HTML escaping function
    - Test slide navigation logic
    - _Requirements: 10.1, 10.5_

- [x] 4. Checkpoint - Verify end-to-end flow
  - Ensure MCP server can spawn Web server
  - Ensure POST /api/lessons creates lesson and returns URL
  - Ensure player can fetch and render title slide
  - Ensure all tests pass
  - Ask the user if questions arise

### Milestone 2: All 20 Slide Templates

- [x] 5. Implement text-based slide renderers
  - [x] 5.1 Implement bullets slide renderer
    - Support heading, style (dot/check/number), items array
    - Render as unordered/ordered list based on style
    - _Requirements: 10.1_
  
  - [x] 5.2 Implement callout slide renderer
    - Support kind (info/tip/warning/success), title, body
    - Apply color-coded styling based on kind
    - _Requirements: 10.1_
  
  - [x] 5.3 Implement definition slide renderer
    - Support term, definition, also fields
    - Render as definition list with emphasis
    - _Requirements: 10.1_
  
  - [x] 5.4 Implement twoColumn slide renderer
    - Support leftHeading, leftBody, rightHeading, rightBody
    - Render as two-column layout with CSS grid
    - _Requirements: 10.1_
  
  - [x] 5.5 Implement warning slide renderer
    - Support title, pitfalls array
    - Render with warning icon and red accent
    - _Requirements: 10.1_
  
  - [x] 5.6 Implement summary slide renderer
    - Support heading, points array (NOT bullets)
    - Render as checklist with green checkmarks
    - _Requirements: 10.1_
  
  - [x]* 5.7 Write unit tests for text-based renderers
    - Test each renderer with valid data
    - Test HTML escaping in all text fields
    - _Requirements: 10.1_

- [x] 6. Implement code-based slide renderers
  - [x] 6.1 Implement code slide renderer
    - Support heading, caption, language, code, highlight array
    - Integrate highlight.js for syntax highlighting
    - Apply line highlighting based on highlight array
    - _Requirements: 10.1, 10.5_
  
  - [x] 6.2 Implement codeCompare slide renderer
    - Support left/right labels, kinds (bad/good), languages, code
    - Render as side-by-side comparison with color coding
    - Apply syntax highlighting to both sides
    - _Requirements: 10.1, 10.5_
  
  - [x] 6.3 Implement terminal slide renderer
    - Support prompt, command, output array
    - Render with monospace font and terminal styling
    - _Requirements: 10.1_
  
  - [x]* 6.4 Write unit tests for code renderers
    - Test code renderer with various languages
    - Test line highlighting logic
    - Test codeCompare side-by-side layout
    - _Requirements: 10.1, 10.5_

- [x] 7. Implement diagram slide renderers
  - [x] 7.1 Implement fileTree slide renderer
    - Support heading, entries array with name, depth, kind, highlight, dim, note
    - Render as flat list with depth-based indentation (NO nested children)
    - Apply highlighting and dimming styles
    - _Requirements: 10.1, 10.6_
  
  - [x] 7.2 Implement flowDiagram slide renderer
    - Support heading (NOT title), direction, nodes, edges
    - Render using Mermaid.js or custom SVG
    - Validate max 8 nodes and label length < 36 chars
    - _Requirements: 10.1, 10.7_
  
  - [x] 7.3 Implement sequenceDiagram slide renderer
    - Support heading, actors, messages array
    - Render using Mermaid.js or custom SVG
    - _Requirements: 10.1_
  
  - [x] 7.4 Implement architecture slide renderer
    - Support heading (NOT title), layers array with name and nodes (NOT items)
    - Render as layered architecture diagram
    - _Requirements: 10.1_
  
  - [x]* 7.5 Write unit tests for diagram renderers
    - Test fileTree depth-based indentation
    - Test flowDiagram node/edge rendering
    - Test architecture layer rendering
    - _Requirements: 10.1, 10.6, 10.7_

- [x] 8. Implement interactive and data slide renderers
  - [x] 8.1 Implement stats slide renderer
    - Support heading, items array with value and label
    - Render as grid of large numbers with labels
    - _Requirements: 10.1_
  
  - [x] 8.2 Implement steps slide renderer
    - Support heading (NOT title), steps array with title and detail (NOT description)
    - Render as numbered list with emphasis
    - _Requirements: 10.1_
  
  - [x] 8.3 Implement timeline slide renderer
    - Support heading, events array with time and event
    - Render as vertical timeline with dates
    - _Requirements: 10.1_
  
  - [x] 8.4 Implement comparison slide renderer
    - Support heading (NOT title), leftLabel/rightLabel (NOT leftTitle/rightTitle), rows array
    - Render as comparison table with 3-6 rows
    - _Requirements: 10.1_
  
  - [x] 8.5 Implement quiz slide renderer
    - Support question, choices array, answerIndex, explanation
    - Render as interactive multiple choice (click to reveal answer)
    - _Requirements: 10.1_
  
  - [x] 8.6 Implement image slide renderer
    - Support url, alt, caption
    - Render as centered image with caption
    - _Requirements: 10.1_
  
  - [x]* 8.7 Write unit tests for interactive renderers
    - Test stats grid layout
    - Test steps numbering
    - Test comparison table structure
    - Test quiz interaction logic
    - _Requirements: 10.1_

- [x] 9. Implement slide type validation
  - [x] 9.1 Create type-specific validation functions
    - Implement validators for all 20 slide types
    - Check required fields for each type
    - Check field types (arrays, objects, strings)
    - Detect common field name mistakes (title vs heading, items vs nodes, description vs detail)
    - Return descriptive errors with slide index and field name
    - _Requirements: 10.2, 10.3, 10.4, 11.6, 11.7_
  
  - [x]* 9.2 Write property test for unknown slide type rejection
    - **Property 4: Unknown Slide Types Are Rejected**
    - **Validates: Requirements 10.2**
    - Test that slides with unknown types are rejected
    - _Requirements: 10.2_
  
  - [x]* 9.3 Write property test for type-specific validation
    - **Property 5: Type-Specific Validation Enforces Schema**
    - **Validates: Requirements 10.3, 10.4**
    - Test that invalid data for each slide type is rejected
    - Generate random invalid data for each of 20 types
    - _Requirements: 10.3, 10.4_
  
  - [x]* 9.4 Write property test for common field name mistakes
    - **Property 15: Common Field Name Mistakes Are Detected**
    - **Validates: Requirements 11.6, 11.7**
    - Test that common mistakes are detected with helpful suggestions
    - Test flowDiagram "title" → "heading", architecture "items" → "nodes", etc.
    - _Requirements: 11.6, 11.7_

- [x] 10. Checkpoint - Verify all slide types render correctly
  - Create test lesson with all 20 slide types
  - Ensure each slide renders without errors
  - Ensure validation catches all schema violations
  - Ensure all tests pass
  - Ask the user if questions arise

### Milestone 3: ElevenLabs TTS Integration + Audio Caching

- [x] 11. Implement ElevenLabs API integration
  - [x] 11.1 Create ElevenLabs streaming client
    - Implement `streamFromElevenLabs()` function
    - Use /v1/text-to-speech/{voiceId}/stream endpoint
    - Set model_id to "eleven_flash_v2_5"
    - Set output_format to mp3_44100_64
    - Set voice_settings (stability=0.4, similarity_boost=0.75, style=0.0, use_speaker_boost=true)
    - _Requirements: 6.3, 6.4, 19.1, 19.3_
  
  - [x] 11.2 Implement GET /audio/:id/:idx.mp3 endpoint
    - Extract lessonId and slideIndex from URL params
    - Fetch lesson and slide from memory
    - Check for API key (return 503 with setupUrl if missing)
    - Stream audio from ElevenLabs while caching
    - Set Content-Type: audio/mpeg and Cache-Control headers
    - _Requirements: 5.2, 6.2, 6.3, 6.5, 7.1, 7.2, 19.2, 19.6_
  
  - [x]* 11.3 Write integration test for ElevenLabs API
    - Test audio synthesis with valid API key
    - Test response headers and content type
    - Skip test if ELEVENLABS_API_KEY not set
    - _Requirements: 6.3, 19.1, 19.6_

- [x] 12. Implement audio caching system
  - [x] 12.1 Create three-tier caching architecture
    - Create `audioCache` Map for storing audio buffers
    - Create `inflight` Map for deduplicating concurrent requests
    - Implement cache hit logic (return cached buffer immediately)
    - Implement cache miss logic (stream + cache simultaneously)
    - Implement inflight deduplication (await existing promise)
    - _Requirements: 6.1, 6.2, 6.6, 6.7_
  
  - [x]* 12.2 Write property test for cache hit performance
    - **Property 10: Audio Cache Hit Performance**
    - **Validates: Requirements 6.1, 6.2**
    - Test that second request is served from cache (< 10ms)
    - Test that cached audio is identical to original
    - _Requirements: 6.1, 6.2_
  
  - [x]* 12.3 Write property test for cached audio headers
    - **Property 11: Cached Audio Has Correct Headers**
    - **Validates: Requirements 6.2**
    - Test that cached responses have correct Content-Type and Cache-Control
    - _Requirements: 6.2_

- [x] 13. Implement API key management
  - [x] 13.1 Create API key storage and retrieval
    - Implement `readKey()` function reading from ~/.kiro/config.json or ELEVENLABS_API_KEY env var
    - Implement `writeKey()` function writing to ~/.kiro/config.json with mode 0o600
    - Create ~/.kiro directory if it doesn't exist
    - _Requirements: 2.1, 2.4, 2.5, 9.6, 17.5_
  
  - [x] 13.2 Implement POST /api/key endpoint
    - Accept API key in request body
    - Validate key against ElevenLabs /v1/user endpoint
    - Return 400 with error if validation fails
    - Write key to config file if valid
    - _Requirements: 2.2, 2.3_
  
  - [x] 13.3 Implement GET /api/key-status endpoint
    - Return { hasKey: boolean } based on config file
    - _Requirements: 2.4_
  
  - [x] 13.4 Create /setup page for API key entry
    - Serve HTML form at GET /setup
    - Accept ?return= query param for redirect after save
    - Redirect to return URL after successful key save
    - _Requirements: 2.5, 2.6_
  
  - [x]* 13.5 Write unit tests for API key management
    - Test key reading from file and env var
    - Test key writing with correct permissions
    - Test key validation against ElevenLabs
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 14. Implement player audio playback
  - [x] 14.1 Add audio element and playback logic
    - Create HTMLAudioElement in player.js
    - Set audio.src to /audio/{id}/{index}.mp3 on slide change
    - Call audio.play() when slide loads
    - Add audio.onended handler to auto-advance to next slide
    - _Requirements: 5.2, 5.3, 5.4_
  
  - [x] 14.2 Implement audio prefetching
    - Create `warmAudio()` function to prefetch audio
    - Prefetch audio for next 2 slides during playback
    - Use Image() or fetch() to trigger browser cache
    - _Requirements: 5.5, 19.5_
  
  - [x] 14.3 Implement audio error handling
    - Add audio.onerror handler
    - Fetch audio URL to get error details
    - Display specific error messages (no_key, invalid_key, rate_limit)
    - Show setup link for no_key error
    - Allow navigation even when audio fails
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 8.1, 8.2_
  
  - [x]* 14.4 Write unit tests for audio playback
    - Test audio.src setting on slide change
    - Test auto-advance on audio end
    - Test prefetching logic
    - Test error handling for various error codes
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

- [x] 15. Implement error handling and graceful degradation
  - [x] 15.1 Add rate limiting error handling
    - Detect 429 status from ElevenLabs
    - Return 429 to client with descriptive message
    - Display "Rate limit reached" message in player
    - _Requirements: 8.1, 8.2_
  
  - [x] 15.2 Add network failure error handling
    - Wrap ElevenLabs calls in try-catch
    - Return 502 on network errors
    - Log errors to stderr with [audio] prefix
    - Handle errors after streaming has started
    - _Requirements: 8.3, 8.4, 8.5_
  
  - [x] 15.3 Add unhandled error handlers
    - Add process.on('unhandledRejection') handler
    - Add process.on('uncaughtException') handler
    - Log errors without terminating server
    - _Requirements: 8.6_
  
  - [x]* 15.4 Write integration tests for error handling
    - Test rate limit error flow
    - Test invalid API key error flow
    - Test network failure error flow
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 16. Checkpoint - Verify audio synthesis and caching
  - Ensure audio synthesizes from ElevenLabs
  - Ensure audio caching works (second play is instant)
  - Ensure error handling works (missing key, rate limits)
  - Ensure all tests pass
  - Ask the user if questions arise

### Milestone 4: Repo Scanner + Lesson Generator Logic

- [x] 17. Implement repository scanner (agent-side)
  - [x] 17.1 Create directory traversal logic
    - Implement `scanDirectory()` function using fs.readdir recursively
    - Respect .gitignore rules using ignore library
    - Return flat array with depth values for each entry
    - Identify file types by extension
    - _Requirements: 13.1, 13.2, 13.4, 13.6_
  
  - [x] 17.2 Implement git metadata extraction
    - Implement `getGitMetadata()` function using simple-git library
    - Extract branch name, commit hash, remote URL
    - Handle non-git directories gracefully
    - _Requirements: 13.3_
  
  - [x] 17.3 Implement file reading
    - Implement `readFile()` function using fs.readFile
    - Return file contents as string
    - Handle encoding errors gracefully
    - _Requirements: 13.5_
  
  - [x]* 17.4 Write unit tests for repo scanner
    - Test directory traversal with nested structure
    - Test .gitignore respect
    - Test git metadata extraction
    - Test file reading
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6_

- [x] 18. Implement lesson generator (agent-side)
  - [x] 18.1 Create full repository lesson generator
    - Implement `generateFullRepoLesson()` function
    - Scan repository structure
    - Identify entry points and key components
    - Generate 6-10 slides (title, fileTree, architecture, code, summary)
    - Write conversational narration (1-3 sentences per slide)
    - _Requirements: 3.6, 3.7, 4.1, 4.2_
  
  - [x] 18.2 Create focused lesson generator
    - Implement `generateFocusedLesson()` function
    - Accept file paths and focus description
    - Prioritize content from specified paths
    - Include related context when necessary
    - Generate 4-8 slides based on scope
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  
  - [x]* 18.3 Write integration tests for lesson generation
    - Test full repo lesson generation on sample repo
    - Test focused lesson generation on specific files
    - Verify slide count is within recommended range
    - Verify first slide is title, last is summary
    - _Requirements: 3.6, 3.7, 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 19. Implement lesson metadata handling
  - [x] 19.1 Add metadata to lesson schema
    - Update lesson validation to accept title, summary, repo, voiceId
    - Make summary, repo, voiceId optional
    - Validate repo structure (name, branch, commit)
    - _Requirements: 18.1, 18.2, 18.3, 18.4_
  
  - [x] 19.2 Display metadata in player
    - Show lesson title on start screen
    - Show summary if present
    - Show repo metadata (name, branch, commit) if present
    - _Requirements: 18.1, 18.5_
  
  - [x]* 19.3 Write property test for metadata preservation
    - **Property 1: Lesson Round-Trip Preservation**
    - **Validates: Requirements 15.3, 15.4, 15.5, 15.6, 18.1-18.5**
    - Test that metadata is preserved during JSON round-trip
    - Test with optional fields present and absent
    - Test with Unicode characters in all text fields
    - _Requirements: 15.3, 15.4, 15.5, 15.6, 18.1, 18.2, 18.3, 18.4, 18.5_

- [x] 20. Checkpoint - Verify lesson generation
  - Ensure repo scanner can traverse directories
  - Ensure lesson generator produces valid lessons
  - Ensure metadata is displayed in player
  - Ensure all tests pass
  - Ask the user if questions arise

### Milestone 5: Landing Page + Install Flows + Polish

- [x] 21. Implement landing page
  - [x] 21.1 Create landing page HTML and CSS
    - Create index.html with dark pixel-art aesthetic
    - Use deep purple background with cyan/pink/yellow accents
    - Add installation snippets for Kiro, Claude Code, Codex, Cursor, Windsurf
    - Add link to ElevenLabs API key creation page
    - Explain local-first privacy model
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_
  
  - [x] 21.2 Serve landing page at root path
    - Update GET / endpoint to serve index.html
    - _Requirements: 12.1, 20.2_
  
  - [x]* 21.3 Write unit tests for landing page
    - Test that GET / returns HTML
    - Test that installation snippets are present
    - _Requirements: 12.1, 20.2_

- [x] 22. Implement static asset serving
  - [x] 22.1 Set up static file serving
    - Use express.static for public/ directory
    - Serve player.html at /view/:id paths
    - Serve player.js and player.css as static assets
    - Set appropriate Content-Type headers
    - _Requirements: 20.1, 20.3, 20.4, 20.5_
  
  - [x]* 22.2 Write unit tests for static serving
    - Test that static files are served with correct headers
    - Test that /view/:id serves player.html
    - _Requirements: 20.1, 20.3, 20.4, 20.5_

- [x] 23. Implement environment configuration
  - [x] 23.1 Add environment variable support
    - Read ELEVENLABS_VOICE_ID (default: "21m00Tcm4TlvDq8ikWAM")
    - Read ELEVENLABS_OUTPUT_FORMAT (default: "mp3_44100_64")
    - Read PORT (default: 4178)
    - Read ELEVENLABS_API_KEY as fallback
    - Log active voice, model, format on startup
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6_
  
  - [x]* 23.2 Write unit tests for environment config
    - Test default values when env vars not set
    - Test custom values when env vars set
    - Test startup logging
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6_

- [x] 24. Implement MCP tool response handling
  - [x] 24.1 Update create_lesson tool to return URLs
    - Return viewUrl in format http://localhost:{port}/view/{id}
    - Return setupUrl if no API key saved
    - Update MCP server to forward response from Web server
    - _Requirements: 3.4, 3.5_
  
  - [x]* 24.2 Write property test for URL format
    - **Property 9: View URL Format**
    - **Validates: Requirements 3.4**
    - Test that viewUrl matches expected format
    - Test that lessonId is 12-character hex string
    - _Requirements: 3.4_

- [x] 25. Add comprehensive validation error messages
  - [x] 25.1 Enhance validation error messages
    - Include slide index in all validation errors
    - Include exact field name in all validation errors
    - Suggest corrections for common mistakes
    - _Requirements: 10.4, 11.5, 11.6, 11.7_
  
  - [x]* 25.2 Write property tests for error message quality
    - **Property 6: Validation Errors Include Slide Index**
    - **Validates: Requirements 10.4, 11.5**
    - **Property 7: Validation Errors Include Field Name**
    - **Validates: Requirements 10.4, 11.5**
    - Test that errors contain slide index
    - Test that errors contain field name
    - _Requirements: 10.4, 11.5_

- [x] 26. Add remaining property tests
  - [x]* 26.1 Write property test for narration length validation
    - **Property 12: Narration Length Validation**
    - **Validates: Requirements 11.4**
    - Test that narrations > 500 chars are rejected
    - _Requirements: 11.4_
  
  - [x]* 26.2 Write property test for slide count validation
    - **Property 13: Slide Count Validation**
    - **Validates: Requirements 11.2**
    - Test that 0 slides and > 20 slides are rejected
    - _Requirements: 11.2_
  
  - [x]* 26.3 Write property test for required fields validation
    - **Property 14: Required Slide Fields Validation**
    - **Validates: Requirements 11.3**
    - Test that missing type, narration, or data is rejected
    - _Requirements: 11.3_

- [x] 27. Final polish and documentation
  - [x] 27.1 Update README with installation instructions
    - Add installation instructions for all supported agents
    - Add usage examples
    - Add troubleshooting section
    - Document environment variables
  
  - [x] 27.2 Add JSDoc comments to all functions
    - Document parameters and return types
    - Add usage examples for complex functions
  
  - [x] 27.3 Add error logging improvements
    - Ensure all errors are logged with appropriate prefixes
    - Add request IDs for debugging
    - Log startup configuration

- [x] 28. Final checkpoint - End-to-end verification
  - Ensure MCP server can be installed via npx
  - Ensure full lesson creation flow works
  - Ensure all 20 slide types render correctly
  - Ensure audio synthesis and caching work
  - Ensure error handling is graceful
  - Ensure all tests pass (unit, property, integration)
  - Ask the user if questions arise

## Notes

- Tasks marked with `*` are optional testing tasks and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at milestone boundaries
- Property tests validate universal correctness properties (15 properties total)
- Unit tests validate specific examples and edge cases
- Integration tests validate external service integration (ElevenLabs, MCP)
- Implementation uses TypeScript for MCP server, JavaScript for Web server and Player
- All code should follow existing project structure and conventions
