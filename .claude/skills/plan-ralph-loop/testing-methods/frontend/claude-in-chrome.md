# Browser Verification with Claude in Chrome

Use Claude in Chrome MCP tools for frontend/UI verification during Ralph Loop iterations.

## Setup

1. Ensure Claude in Chrome extension is installed and connected
2. Get tab context at session start:
   ```
   mcp__claude-in-chrome__tabs_context_mcp
   ```

## Core Verification Tools

### Navigate to Dev Server

```javascript
mcp__claude-in-chrome__navigate({
  url: "http://localhost:{PORT}",
  tabId: {TAB_ID}
})
```

### Read Page Structure

```javascript
mcp__claude-in-chrome__read_page({
  tabId: {TAB_ID},
  filter: "interactive"  // or "all" for complete tree
})
```

### Find Specific Elements

```javascript
mcp__claude-in-chrome__find({
  query: "submit button",  // Natural language query
  tabId: {TAB_ID}
})
```

### Take Screenshots

```javascript
mcp__claude-in-chrome__computer({
  action: "screenshot",
  tabId: {TAB_ID}
})
```

### Interact with Elements

**Click:**
```javascript
mcp__claude-in-chrome__computer({
  action: "left_click",
  ref: "ref_1",  // Element reference from read_page or find
  tabId: {TAB_ID}
})
```

**Type text:**
```javascript
mcp__claude-in-chrome__computer({
  action: "type",
  text: "input text here",
  tabId: {TAB_ID}
})
```

**Form input:**
```javascript
mcp__claude-in-chrome__form_input({
  ref: "ref_1",
  value: "field value",
  tabId: {TAB_ID}
})
```

## Verification Workflow

### Basic E2E Test Pattern

1. Navigate to dev server URL
2. Take screenshot of initial state
3. Verify key elements exist using `read_page` or `find`
4. If elements missing, test FAILS - fix before proceeding

### Feature Verification Pattern

1. Navigate to relevant page
2. Perform the user action (click, input, etc.)
3. Wait briefly for state change
4. Take screenshot of result
5. Verify expected outcome:
   - Element appears/changes
   - No console errors
   - Correct content displayed

### Console Error Check

```javascript
mcp__claude-in-chrome__read_console_messages({
  tabId: {TAB_ID},
  onlyErrors: true
})
```

## Example: Verify Button Click

```javascript
// 1. Navigate to page
await mcp__claude-in-chrome__navigate({
  url: "http://localhost:5008/dashboard",
  tabId: tabId
});

// 2. Find the button
const result = await mcp__claude-in-chrome__find({
  query: "New Report button",
  tabId: tabId
});

// 3. Click it
await mcp__claude-in-chrome__computer({
  action: "left_click",
  ref: result.ref,
  tabId: tabId
});

// 4. Wait for modal
await mcp__claude-in-chrome__computer({
  action: "wait",
  duration: 1,
  tabId: tabId
});

// 5. Screenshot result
await mcp__claude-in-chrome__computer({
  action: "screenshot",
  tabId: tabId
});

// 6. Verify modal appeared
const page = await mcp__claude-in-chrome__read_page({
  tabId: tabId,
  filter: "interactive"
});
// Check for modal elements in page structure
```

## Tips

- Always get fresh tab context at session start
- Create new tab rather than reusing existing tabs
- Take screenshots before AND after actions for comparison
- Use `find` with natural language for resilient element selection
- Check console for errors after each significant action
