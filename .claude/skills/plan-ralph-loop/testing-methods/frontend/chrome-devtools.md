# Browser Verification with Chrome DevTools MCP

Use Chrome DevTools MCP tools for frontend/UI verification during Ralph Loop iterations.

**Important:** This is the correct tool for spawned/print-mode sessions. Claude in Chrome MCP tools do NOT work in spawned sessions.

## Available Tools

| Tool | Purpose |
|------|---------|
| `mcp__chrome-devtools__list_pages` | List all Chrome pages/tabs |
| `mcp__chrome-devtools__navigate_page` | Navigate to a URL |
| `mcp__chrome-devtools__take_screenshot` | Capture visual state |
| `mcp__chrome-devtools__take_snapshot` | Capture DOM snapshot |
| `mcp__chrome-devtools__evaluate_script` | Run JavaScript on the page |
| `mcp__chrome-devtools__list_console_messages` | Check for JS errors |
| `mcp__chrome-devtools__resize_page` | Change viewport size |

## Setup

1. Ensure Chrome is running with remote debugging enabled
2. The Chrome DevTools MCP server must be configured in Claude settings

## Core Verification Workflow

### 1. List Available Pages

```javascript
mcp__chrome-devtools__list_pages()
```

Returns list of available Chrome tabs. Note the page ID for subsequent calls.

### 2. Navigate to Dev Server

```javascript
mcp__chrome-devtools__navigate_page({
  pageId: "{PAGE_ID}",
  url: "http://localhost:{PORT}"
})
```

### 3. Take Screenshot

```javascript
mcp__chrome-devtools__take_screenshot({
  pageId: "{PAGE_ID}"
})
```

### 4. Check Console for Errors

```javascript
mcp__chrome-devtools__list_console_messages({
  pageId: "{PAGE_ID}"
})
```

### 5. Interact with Elements (via JavaScript)

```javascript
mcp__chrome-devtools__evaluate_script({
  pageId: "{PAGE_ID}",
  script: "document.querySelector('button.submit').click()"
})
```

## Verification Patterns

### Basic E2E Test Pattern

1. List pages to get page ID
2. Navigate to dev server URL
3. Take screenshot of initial state
4. Check console for errors
5. If errors exist, test FAILS - fix before proceeding

### Feature Verification Pattern

1. Navigate to relevant page
2. Use `evaluate_script` to interact with elements
3. Wait briefly for state change (use setTimeout in script if needed)
4. Take screenshot of result
5. Check console for errors
6. Verify expected outcome

### Example: Verify Button Opens Dialog

```javascript
// 1. Navigate to page
mcp__chrome-devtools__navigate_page({
  pageId: pageId,
  url: "http://localhost:5007/dashboard"
})

// 2. Click button via JavaScript
mcp__chrome-devtools__evaluate_script({
  pageId: pageId,
  script: `
    const btn = document.querySelector('[data-testid="new-task-btn"]');
    if (btn) btn.click();
    !!btn;
  `
})

// 3. Wait and screenshot
mcp__chrome-devtools__take_screenshot({
  pageId: pageId
})

// 4. Verify dialog appeared
mcp__chrome-devtools__evaluate_script({
  pageId: pageId,
  script: `
    const dialog = document.querySelector('[role="dialog"]');
    !!dialog;
  `
})

// 5. Check for errors
mcp__chrome-devtools__list_console_messages({
  pageId: pageId
})
```

## Tips

- Always list pages first to get valid page IDs
- Take screenshots before AND after actions for comparison
- Use `evaluate_script` for complex interactions
- Check console messages after significant actions
- Use meaningful selectors (data-testid, aria-label) for reliable element selection
