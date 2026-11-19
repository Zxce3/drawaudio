# DrawAudio MCP server

A [Model Context Protocol](https://modelcontextprotocol.io) server that lets AI agents compose, edit, validate and share DrawAudio songs. It runs locally over stdio, uses the same validation code as the web app, and needs no network. To hear a song, open the share link it returns.

## Run

```bash
bun install
bun run mcp          # starts the stdio server
```

### Claude Code

```bash
claude mcp add drawaudio -- bun /absolute/path/to/drawaudio/mcp/server.ts
```

### Claude Desktop, Cursor and other clients

```json
{
  "mcpServers": {
    "drawaudio": { "command": "bun", "args": ["/absolute/path/to/drawaudio/mcp/server.ts"] }
  }
}
```

## Tools

| Tool | Purpose |
| --- | --- |
| `list_examples`, `get_example` | The 21 built-in songs |
| `list_scales`, `list_presets`, `get_param_schema` | Valid scales, presets, and every sound and effect parameter with ranges |
| `create_song` | Compose from note-name step strings; returns link, summary and compact JSON |
| `edit_song` | Change tempo, scale, effects, mixer or a track's sound |
| `describe_song` | Summary plus every track as note-name steps (feed it back to `create_song`) |
| `make_share_link` | `https://drawaudio.zxce3.net/#s=...` link that opens the song in the app |
| `export_midi`, `import_midi` | Standard MIDI File in and out |

Songs are passed between tools either as the compact `song` JSON or as a `share_link`.

Step syntax: one string per bar of 16 steps; tokens are `.` (rest), note names like `Eb4`, `C#3` (snapped to the scale), a number (pitch index from the lowest row) or `C4,E4,G4` (several notes at once). Append `~` to hold a note from the previous step (`C4 C4~ C4~ C4~` = one 4-step note); `-` holds every note of the previous step.

See the wiki page "MCP Server" for details and examples.
