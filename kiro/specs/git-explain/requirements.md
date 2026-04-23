# Requirements Document

## Introduction

GitExplain is a local, open-source MCP (Model Context Protocol) server that transforms any codebase into a narrated slide-video lesson. It enables AI coding agents to generate structured lessons with voice narration, diagrams, and code snippets, helping developers rebuild mental models of their codebases without reading everything line-by-line. The system runs entirely locally, with only narration text sent to ElevenLabs for text-to-speech synthesis.

## Glossary

- **GitExplain**: The complete system including MCP server, web server, and player
- **MCP_Server**: The Model Context Protocol stdio server that exposes tools to AI agents
- **Web_Server**: The Express-based HTTP server serving the player and API endpoints
- **Player**: The browser-based application that renders and plays lessons with synced audio
- **Lesson**: A JSON document containing metadata and an ordered array of typed slides
- **Slide**: A single unit of content with a type, narration text, and type-specific data
- **Agent**: An AI coding assistant (Kiro, Claude Code, Codex, Cursor, Windsurf) that calls MCP tools
- **ElevenLabs**: The third-party text-to-speech API service used for narration synthesis
- **API_Key**: The ElevenLabs authentication credential stored locally at ~/.kiro/config.json
- **Lesson_Generator**: The component that analyzes codebases and produces lesson JSON
- **Repo_Scanner**: The component that inspects file trees, reads files, and extracts git metadata
- **Audio_Cache**: In-memory storage for synthesized narration audio to avoid re-synthesis
- **TTS**: Text-to-speech synthesis service (ElevenLabs Flash v2.5)

## Requirements

### Requirement 1: MCP Server Installation

**User Story:** As a developer, I want to install GitExplain into my AI coding agent, so that I can generate code lessons through natural language requests.

#### Acceptance Criteria

1. THE MCP_Server SHALL be installable via `npx -y kiro-mcp` without requiring prior npm install
2. THE MCP_Server SHALL support stdio transport protocol for MCP communication
3. THE MCP_Server SHALL be configurable in Claude Code, Cursor, Windsurf, and Claude Desktop MCP settings
4. WHEN the MCP_Server starts, THE MCP_Server SHALL spawn the Web_Server on an available port
5. WHEN the Web_Server is ready, THE MCP_Server SHALL log the base URL to stderr
6. THE MCP_Server SHALL expose its name as "kiro" and version matching package.json

### Requirement 2: ElevenLabs API Key Management

**User Story:** As a developer, I want to save my ElevenLabs API key once locally, so that I don't need to provide it for every lesson and it never appears in chat transcripts.

#### Acceptance Criteria

1. THE Web_Server SHALL store the API_Key at ~/.kiro/config.json with file permissions 0o600
2. WHEN an API_Key is provided, THE Web_Server SHALL validate it against the ElevenLabs /v1/user endpoint before saving
3. IF the API_Key validation fails, THEN THE Web_Server SHALL return an error message with the HTTP status code from ElevenLabs
4. THE Web_Server SHALL read the API_Key from ~/.kiro/config.json or the ELEVENLABS_API_KEY environment variable
5. THE Web_Server SHALL provide a /setup endpoint that renders a browser form for API_Key entry
6. WHEN the API_Key is successfully saved, THE Web_Server SHALL redirect the browser to the lesson view if a return URL is provided
7. THE MCP_Server SHALL NOT expose any tool or prompt for setting the API_Key (out-of-band setup only)

### Requirement 3: Full Repository Lesson Generation

**User Story:** As a developer, I want to generate a lesson explaining my entire repository, so that I can understand the overall architecture and key components.

#### Acceptance Criteria

1. THE MCP_Server SHALL expose a tool named "create_lesson" that accepts title and slides parameters
2. WHEN the Agent calls create_lesson with valid lesson data, THE Web_Server SHALL validate the lesson structure
3. WHEN lesson validation succeeds, THE Web_Server SHALL assign a unique lesson ID and store the lesson in memory
4. WHEN a lesson is created, THE Web_Server SHALL return a view URL in the format http://localhost:{port}/view/{id}
5. IF no API_Key is saved, THEN THE MCP_Server SHALL return a setup URL alongside the view URL
6. THE Lesson_Generator SHALL produce lessons with 4-14 slides (default 6, recommended range 4-10)
7. THE Lesson_Generator SHALL ensure the first slide is type "title" and the last slide is type "summary"

### Requirement 4: Focused Path Lesson Generation

**User Story:** As a developer, I want to generate a lesson focused on specific files or flows, so that I can understand a particular feature or component in depth.

#### Acceptance Criteria

1. THE Lesson_Generator SHALL accept an array of file paths to focus the lesson scope
2. THE Lesson_Generator SHALL accept an optional focus parameter describing the specific flow or concept
3. WHEN generating a focused lesson, THE Lesson_Generator SHALL prioritize content from the specified paths
4. THE Lesson_Generator SHALL include context from related files when necessary for understanding
5. THE Lesson_Generator SHALL produce lessons with slide counts proportional to scope (4-5 for single files, 6-8 for features)

### Requirement 5: Lesson Playback with Synced Narration

**User Story:** As a developer, I want to play a lesson with voice narration synchronized to slides, so that I can learn about the codebase through audio and visual content.

#### Acceptance Criteria

1. WHEN the Player loads a lesson, THE Player SHALL display the lesson title and slide count on the start screen
2. WHEN the user starts playback, THE Player SHALL request audio for the current slide from /audio/{id}/{index}.mp3
3. WHEN audio playback begins, THE Player SHALL display the slide content synchronized with the audio
4. WHEN audio for a slide completes, THE Player SHALL automatically advance to the next slide
5. THE Player SHALL prefetch audio for the next 2 slides during playback to minimize latency
6. THE Player SHALL provide play/pause, previous/next, restart, and speed controls
7. THE Player SHALL support keyboard shortcuts (Space for play/pause, arrows for navigation, R for restart, C for captions, Esc for pause)

### Requirement 6: Audio Synthesis and Caching

**User Story:** As a developer, I want narration audio to be synthesized on-demand and cached, so that playback is fast and I don't waste API quota on repeated plays.

#### Acceptance Criteria

1. WHEN the Web_Server receives an audio request, THE Web_Server SHALL check the Audio_Cache for existing audio
2. IF cached audio exists, THEN THE Web_Server SHALL return it with Content-Type audio/mpeg and Cache-Control headers
3. IF no cached audio exists, THEN THE Web_Server SHALL request synthesis from ElevenLabs using the Flash v2.5 model
4. WHEN synthesizing audio, THE Web_Server SHALL use mp3_44100_64 output format for low latency
5. WHEN receiving audio from ElevenLabs, THE Web_Server SHALL stream it to the client while simultaneously caching it
6. THE Web_Server SHALL deduplicate concurrent requests for the same slide audio using an inflight map
7. THE Audio_Cache SHALL persist in memory for the lifetime of the Web_Server process

### Requirement 7: Graceful Degradation for Missing or Invalid API Key

**User Story:** As a developer, I want the system to guide me through API key setup when needed, so that I can resolve configuration issues without blocking my workflow.

#### Acceptance Criteria

1. WHEN an audio request is made without a saved API_Key, THE Web_Server SHALL return HTTP 503 with a JSON response containing error "no_key" and a setupUrl
2. WHEN the Player receives a no_key error, THE Player SHALL display a message with a clickable link to the setup page
3. WHEN ElevenLabs returns a 401 or 403 status, THE Web_Server SHALL return the error to the client with the ElevenLabs status code
4. WHEN the Player receives an authentication error, THE Player SHALL display a message suggesting the key may be invalid
5. THE Player SHALL allow navigation between slides even when audio fails to load
6. THE Player SHALL display error states without blocking the user interface

### Requirement 8: Rate Limiting and Error Handling

**User Story:** As a developer, I want the system to handle ElevenLabs rate limits gracefully, so that temporary API issues don't break my experience.

#### Acceptance Criteria

1. WHEN ElevenLabs returns a 429 status, THE Web_Server SHALL return the rate limit error to the client
2. WHEN the Player receives a rate limit error, THE Player SHALL display a message indicating the service is temporarily unavailable
3. WHEN ElevenLabs returns a 5xx status, THE Web_Server SHALL return a 502 status with the error message
4. THE Web_Server SHALL log all ElevenLabs errors to stderr with the [audio] prefix
5. IF audio synthesis fails after streaming has started, THEN THE Web_Server SHALL close the response without crashing
6. THE Web_Server SHALL handle unhandled promise rejections and uncaught exceptions without terminating

### Requirement 9: Privacy and Local Execution

**User Story:** As a developer, I want my source code to stay on my machine, so that I can use GitExplain on proprietary codebases without security concerns.

#### Acceptance Criteria

1. THE Repo_Scanner SHALL read files from the local filesystem only
2. THE Lesson_Generator SHALL process all code analysis locally without external API calls
3. THE Web_Server SHALL send only narration text to ElevenLabs, never source code
4. THE Web_Server SHALL store lessons in memory only, never persisting to disk
5. THE Web_Server SHALL serve the Player from localhost only (no external network binding)
6. THE API_Key SHALL be stored with file permissions 0o600 to prevent unauthorized access

### Requirement 10: Slide Type Support

**User Story:** As a developer, I want lessons to support 20 different slide types, so that the Agent can choose the best visual format for each concept.

#### Acceptance Criteria

1. THE Player SHALL render the following slide types: title, bullets, code, codeCompare, fileTree, flowDiagram, sequenceDiagram, architecture, callout, definition, twoColumn, stats, terminal, steps, timeline, warning, quiz, summary, image, comparison
2. WHEN validating a lesson, THE Web_Server SHALL reject slides with unknown type values
3. WHEN validating a lesson, THE Web_Server SHALL verify that each slide's data object matches the schema for its type
4. THE Web_Server SHALL return descriptive validation errors identifying the exact field name and slide index for schema violations
5. THE Player SHALL apply syntax highlighting to code and codeCompare slides using the specified language
6. THE Player SHALL render fileTree slides as a flat array with depth-based indentation (no nested children)
7. THE Player SHALL limit flowDiagram slides to 8 nodes maximum and validate node label length under 36 characters

### Requirement 11: Lesson Validation

**User Story:** As a developer, I want the system to validate lesson structure before playback, so that I receive clear error messages for malformed lessons.

#### Acceptance Criteria

1. WHEN a lesson is submitted, THE Web_Server SHALL verify it is a non-null object with a slides array
2. WHEN a lesson is submitted, THE Web_Server SHALL verify the slides array contains 1-20 slides
3. WHEN a lesson is submitted, THE Web_Server SHALL verify each slide has type, narration, and data fields
4. WHEN a lesson is submitted, THE Web_Server SHALL verify each narration string is under 500 characters
5. WHEN validation fails, THE Web_Server SHALL return HTTP 400 with a descriptive error message
6. THE Web_Server SHALL validate slide-type-specific data fields and return errors naming the exact incorrect field
7. THE Web_Server SHALL suggest corrections for common field name mistakes (e.g., "use 'heading' not 'title'" for flowDiagram)

### Requirement 12: Landing Page and Installation Instructions

**User Story:** As a developer, I want to see installation instructions for my specific agent, so that I can quickly set up GitExplain.

#### Acceptance Criteria

1. THE Web_Server SHALL serve a landing page at the root path (/)
2. THE landing page SHALL display installation snippets for Kiro, Claude Code, Codex, Cursor, and Windsurf
3. THE landing page SHALL use the existing dark pixel-art aesthetic with deep purple background and cyan/pink/yellow accents
4. THE landing page SHALL include a link to the ElevenLabs API key creation page
5. THE landing page SHALL explain that GitExplain runs locally and source code never leaves the machine

### Requirement 13: Repository Scanning

**User Story:** As a developer, I want the system to analyze my repository structure, so that lessons can include accurate file trees and architecture diagrams.

#### Acceptance Criteria

1. THE Repo_Scanner SHALL traverse the directory tree starting from a provided root path
2. THE Repo_Scanner SHALL respect .gitignore rules when scanning directories
3. THE Repo_Scanner SHALL extract git repository metadata (branch name, commit hash, remote URL) when available
4. THE Repo_Scanner SHALL identify file types by extension for syntax highlighting
5. THE Repo_Scanner SHALL read file contents when requested by the Lesson_Generator
6. THE Repo_Scanner SHALL return file tree data as a flat array with depth values for each entry

### Requirement 14: Lesson Schema Documentation

**User Story:** As an AI agent, I want access to complete slide type schemas, so that I can generate valid lessons without trial and error.

#### Acceptance Criteria

1. THE MCP_Server SHALL expose a prompt named "slide_types_guide" containing the complete schema reference
2. THE slide_types_guide prompt SHALL document all 20 slide types with field names, types, and examples
3. THE slide_types_guide prompt SHALL include composition tips for each slide type
4. THE MCP_Server SHALL include abbreviated schema documentation in the create_lesson tool description
5. THE create_lesson tool description SHALL highlight common field name mistakes with [COMMON MISTAKE] annotations

### Requirement 15: Parser and Serializer Round-Trip Testing

**User Story:** As a developer, I want the lesson JSON parser to correctly handle all valid lesson structures, so that lessons are never corrupted during processing.

#### Acceptance Criteria

1. THE Web_Server SHALL parse incoming lesson JSON using JSON.parse
2. THE Web_Server SHALL serialize lessons for storage using JSON.stringify
3. FOR ALL valid lesson objects, parsing then serializing then parsing SHALL produce an equivalent object (round-trip property)
4. THE Web_Server SHALL preserve all slide data fields during round-trip processing
5. THE Web_Server SHALL maintain slide order during round-trip processing
6. THE Web_Server SHALL handle Unicode characters in narration text without corruption

### Requirement 16: Server Lifecycle Management

**User Story:** As a developer, I want the server to start and stop cleanly, so that I can run GitExplain reliably without port conflicts or zombie processes.

#### Acceptance Criteria

1. WHEN the Web_Server starts, THE Web_Server SHALL bind to the PORT environment variable or default to 4178
2. WHEN PORT is set to 0, THE Web_Server SHALL bind to any available port and log the actual port number
3. WHEN the MCP_Server receives SIGINT or SIGTERM, THE MCP_Server SHALL kill the Web_Server child process
4. WHEN the Web_Server receives SIGINT or SIGTERM, THE Web_Server SHALL close the HTTP server and exit with code 0
5. THE Web_Server SHALL exit with code 0 within 1 second of receiving a shutdown signal
6. IF the Web_Server fails to start within 8 seconds, THEN THE MCP_Server SHALL reject the startup promise with a timeout error

### Requirement 17: Environment Configuration

**User Story:** As a developer, I want to configure voice, model, and format settings via environment variables, so that I can customize narration without code changes.

#### Acceptance Criteria

1. THE Web_Server SHALL read ELEVENLABS_VOICE_ID from environment or default to "21m00Tcm4TlvDq8ikWAM" (Rachel)
2. THE Web_Server SHALL use the "eleven_flash_v2_5" model for all TTS requests
3. THE Web_Server SHALL read ELEVENLABS_OUTPUT_FORMAT from environment or default to "mp3_44100_64"
4. THE Web_Server SHALL read PORT from environment or default to 4178
5. THE Web_Server SHALL read ELEVENLABS_API_KEY from environment as a fallback if ~/.kiro/config.json does not contain a key
6. THE Web_Server SHALL log the active voice, model, and format settings to stdout on startup

### Requirement 18: Lesson Metadata

**User Story:** As a developer, I want lessons to include metadata about the repository, so that I can identify which codebase a lesson explains.

#### Acceptance Criteria

1. THE Lesson SHALL include a title field displayed on the Player start screen
2. THE Lesson SHALL optionally include a summary field describing the lesson content
3. THE Lesson SHALL optionally include a repo field containing repository metadata (name, branch, commit)
4. THE Lesson SHALL optionally include a voiceId field to override the default voice for that lesson
5. THE Player SHALL display lesson metadata on the start screen before playback begins

### Requirement 19: Audio Streaming Performance

**User Story:** As a developer, I want audio to start playing quickly, so that lessons feel responsive and engaging.

#### Acceptance Criteria

1. WHEN requesting audio from ElevenLabs, THE Web_Server SHALL use the /stream endpoint for immediate response
2. THE Web_Server SHALL stream audio chunks to the client as they arrive from ElevenLabs
3. THE Web_Server SHALL set voice_settings with stability=0.4, similarity_boost=0.75, style=0.0, use_speaker_boost=true
4. THE Player SHALL begin playback as soon as the first audio chunk is received
5. THE Player SHALL prefetch audio for slides 1 and 2 while slide 0 is playing
6. THE Web_Server SHALL set Cache-Control: public, max-age=3600 on audio responses

### Requirement 20: Static Asset Serving

**User Story:** As a developer, I want the player UI to load quickly from local files, so that I can start viewing lessons without network delays.

#### Acceptance Criteria

1. THE Web_Server SHALL serve static files from the public/ directory
2. THE Web_Server SHALL serve index.html at the root path (/)
3. THE Web_Server SHALL serve player.html at /view/{id} paths
4. THE Web_Server SHALL serve player.js and player.css as static assets
5. THE Web_Server SHALL set appropriate Content-Type headers for HTML, CSS, and JavaScript files
