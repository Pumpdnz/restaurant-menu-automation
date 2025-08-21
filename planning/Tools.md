# **Claude Code Default Tools**

Task(
  description: string,
  prompt: string,
  subagent_type: string
): any
// Launch specialized agents for complex tasks. Available agents: general-purpose, delivery-url-finder, restaurant-brand-discovery, menu-extractor, google-business-extractor, meta-agent

Bash(
  command: string,
  description?: string,
  timeout?: number
): any
// Execute bash commands with optional timeout (max 600000ms)

Glob(
  pattern: string,
  path?: string
): any
// Fast file pattern matching with glob patterns like "**/*.js"

Grep(
  pattern: string,
  path?: string,
  output_mode?: "content" | "files_with_matches" | "count",
  glob?: string,
  type?: string,
  -i?: boolean,
  -n?: boolean,
  -A?: number,
  -B?: number,
  -C?: number,
  head_limit?: number,
  multiline?: boolean
): any
// Powerful search tool using ripgrep for regex searches in files

LS(
  path: string,
  ignore?: string[]
): any
// List files and directories at absolute path with optional ignore patterns

ExitPlanMode(
  plan: string
): any
// Exit plan mode after presenting implementation plan for coding tasks

Read(
  file_path: string,
  limit?: number,
  offset?: number
): any
// Read files including images and PDFs, supports line limits and offsets

Edit(
  file_path: string,
  old_string: string,
  new_string: string,
  replace_all?: boolean
): any
// Replace exact string matches in files with optional replace-all

MultiEdit(
  file_path: string,
  edits: Array<{old_string: string, new_string: string, replace_all?: boolean}>
): any
// Make multiple sequential edits to a single file

Write(
  file_path: string,
  content: string
): any
// Write content to file (overwrites existing)

NotebookRead(
  notebook_path: string,
  cell_id?: string
): any
// Read Jupyter notebook cells and outputs

NotebookEdit(
  notebook_path: string,
  new_source: string,
  cell_id?: string,
  cell_type?: "code" | "markdown",
  edit_mode?: "replace" | "insert" | "delete"
): any
// Edit Jupyter notebook cells

WebFetch(
  url: string,
  prompt: string
): any
// Fetch and analyze web content with AI processing

TodoWrite(
  todos: Array<{id: string, content: string, status: "pending" | "in_progress" | "completed", priority: "high" | "medium" | "low"}>
): any
// Create and manage structured task lists

WebSearch(
  query: string,
  allowed_domains?: string[],
  blocked_domains?: string[]
): any
// Search the web with domain filtering


ListMcpResourcesTool(
  server?: string
): any
// List MCP server resources

ReadMcpResourceTool(
  server: string,
  uri: string
): any
// Read MCP resource content

mcp__ide__getDiagnostics(
  uri?: string
): any
// Get VS Code language diagnostics

mcp__ide__executeCode(
  code: string
): any
// Execute Python in Jupyter kernel

# **Stripe** - *Billing and payments*

mcp__stripe__create_customer(
  name: string,
  email?: string
): any
// Create a Stripe customer

mcp__stripe__list_customers(
  email?: string,
  limit?: number
): any
// List Stripe customers with optional filters

mcp__stripe__create_product(
  name: string,
  description?: string
): any
// Create a Stripe product

mcp__stripe__list_products(
  limit?: number
): any
// List Stripe products

mcp__stripe__create_price(
  product: string,
  unit_amount: number,
  currency: string
): any
// Create a Stripe price

mcp__stripe__list_prices(
  product?: string,
  limit?: number
): any
// List Stripe prices

mcp__stripe__create_payment_link(
  price: string,
  quantity: number
): any
// Create a Stripe payment link

mcp__stripe__create_invoice(
  customer: string,
  days_until_due?: number
): any
// Create a Stripe invoice

mcp__stripe__create_invoice_item(
  customer: string,
  price: string,
  invoice: string
): any
// Create a Stripe invoice item

mcp__stripe__finalize_invoice(
  invoice: string
): any
// Finalize a Stripe invoice

mcp__stripe__retrieve_balance(): any
// Get Stripe account balance

mcp__stripe__create_refund(
  payment_intent: string,
  amount?: number
): any
// Refund a Stripe payment

mcp__stripe__list_payment_intents(
  customer?: string,
  limit?: number
): any
// List Stripe payment intents

mcp__stripe__list_subscriptions(
  customer?: string,
  price?: string,
  status?: string,
  limit?: number
): any
// List Stripe subscriptions

mcp__stripe__cancel_subscription(
  subscription: string
): any
// Cancel a Stripe subscription

mcp__stripe__update_subscription(
  subscription: string,
  items?: Array<{id?: string, price?: string, quantity?: number, deleted?: boolean}>,
  proration_behavior?: string
): any
// Update a Stripe subscription

mcp__stripe__search_stripe_documentation(
  question: string,
  language?: string
): any
// Search Stripe documentation

mcp__stripe__list_coupons(
  limit?: number
): any
// List Stripe coupons

mcp__stripe__create_coupon(
  name: string,
  amount_off: number,
  currency?: string,
  percent_off?: number,
  duration?: string,
  duration_in_months?: number
): any
// Create a Stripe coupon

mcp__stripe__update_dispute(
  dispute: string,
  evidence?: object,
  submit?: boolean
): any
// Update a Stripe dispute with evidence

mcp__stripe__list_disputes(
  charge?: string,
  payment_intent?: string,
  limit?: number
): any
// List Stripe disputes

# **Supabase** - *Database Operations*

mcp__supabase__list_organizations(): any
// List user's Supabase organizations

mcp__supabase__get_organization(
  id: string
): any
// Get Supabase organization details

mcp__supabase__list_projects(): any
// List all Supabase projects

mcp__supabase__get_project(
  id: string
): any
// Get Supabase project details

mcp__supabase__get_cost(
  type: "project" | "branch",
  organization_id: string
): any
// Get cost for creating project/branch

mcp__supabase__confirm_cost(
  type: "project" | "branch",
  recurrence: "hourly" | "monthly",
  amount: number
): any
// Confirm cost understanding for creation

mcp__supabase__create_project(
  name: string,
  organization_id: string,
  confirm_cost_id: string,
  region?: string
): any
// Create new Supabase project

mcp__supabase__pause_project(
  project_id: string
): any
// Pause a Supabase project

mcp__supabase__restore_project(
  project_id: string
): any
// Restore a paused project

mcp__supabase__create_branch(
  project_id: string,
  confirm_cost_id: string,
  name?: string
): any
// Create development branch

mcp__supabase__list_branches(
  project_id: string
): any
// List project branches

mcp__supabase__delete_branch(
  branch_id: string
): any
// Delete a development branch

mcp__supabase__merge_branch(
  branch_id: string
): any
// Merge branch to production

mcp__supabase__reset_branch(
  branch_id: string,
  migration_version?: string
): any
// Reset branch migrations

mcp__supabase__rebase_branch(
  branch_id: string
): any
// Rebase branch on production

mcp__supabase__list_tables(
  project_id: string,
  schemas?: string[]
): any
// List database tables

mcp__supabase__list_extensions(
  project_id: string
): any
// List database extensions

mcp__supabase__list_migrations(
  project_id: string
): any
// List database migrations

mcp__supabase__apply_migration(
  project_id: string,
  name: string,
  query: string
): any
// Apply DDL migration

mcp__supabase__execute_sql(
  project_id: string,
  query: string
): any
// Execute raw SQL query

mcp__supabase__get_logs(
  project_id: string,
  service: "api" | "branch-action" | "postgres" | "edge-function" | "auth" | "storage" | "realtime"
): any
// Get service logs

mcp__supabase__get_advisors(
  project_id: string,
  type: "security" | "performance"
): any
// Get security/performance advisories

mcp__supabase__get_project_url(
  project_id: string
): any
// Get project API URL

mcp__supabase__get_anon_key(
  project_id: string
): any
// Get project anonymous key

mcp__supabase__generate_typescript_types(
  project_id: string
): any
// Generate TypeScript types

mcp__supabase__search_docs(
  graphql_query: string
): any
// Search Supabase documentation

mcp__supabase__list_edge_functions(
  project_id: string
): any
// List Edge Functions

mcp__supabase__deploy_edge_function(
  project_id: string,
  name: string,
  files: Array<{name: string, content: string}>,
  entrypoint_path?: string,
  import_map_path?: string
): any
// Deploy Edge Function

# **Puppeteer** - *Browser Automation*

mcp__puppeteer__puppeteer_navigate(
  url: string,
  launchOptions?: object,
  allowDangerous?: boolean
): any
// Navigate browser to URL

mcp__puppeteer__puppeteer_screenshot(
  name: string,
  selector?: string,
  width?: number,
  height?: number,
  encoded?: boolean
): any
// Take browser screenshot

mcp__puppeteer__puppeteer_click(
  selector: string
): any
// Click browser element

mcp__puppeteer__puppeteer_fill(
  selector: string,
  value: string
): any
// Fill browser input field

mcp__puppeteer__puppeteer_select(
  selector: string,
  value: string
): any
// Select dropdown option

mcp__puppeteer__puppeteer_hover(
  selector: string
): any
// Hover over element

mcp__puppeteer__puppeteer_evaluate(
  script: string
): any
// Execute JavaScript in browser

mcp__Context7__resolve-library-id(
  libraryName: string
): any
// Resolve package name to Context7 library ID

mcp__Context7__get-library-docs(
  context7CompatibleLibraryID: string,
  tokens?: number,
  topic?: string
): any
// Get library documentation

# **Browser Tools** - *Debugging*

mcp__browser-tools-mcp__getConsoleLogs(): any
// Get browser console logs

mcp__browser-tools-mcp__getConsoleErrors(): any
// Get browser console errors

mcp__browser-tools-mcp__getNetworkErrors(): any
// Get network error logs

mcp__browser-tools-mcp__getNetworkLogs(): any
// Get all network logs

mcp__browser-tools-mcp__takeScreenshot(): any
// Take browser screenshot

mcp__browser-tools-mcp__getSelectedElement(): any
// Get selected DOM element

mcp__browser-tools-mcp__wipeLogs(): any
// Clear browser logs

mcp__browser-tools-mcp__runAccessibilityAudit(): any
// Run accessibility audit

mcp__browser-tools-mcp__runPerformanceAudit(): any
// Run performance audit

mcp__browser-tools-mcp__runSEOAudit(): any
// Run SEO audit

mcp__browser-tools-mcp__runNextJSAudit(): any
// Run Next.js specific audit

mcp__browser-tools-mcp__runDebuggerMode(): any
// Enable debugging mode

mcp__browser-tools-mcp__runAuditMode(): any
// Run comprehensive audit

mcp__browser-tools-mcp__runBestPracticesAudit(): any
// Run best practices audit

# **Eleven Labs** - *Voice Agents / Text to Speech*

mcp__ElevenLabs__text_to_speech(
  text: string,
  voice_name?: string,
  voice_id?: string,
  model_id?: string,
  stability?: number,
  similarity_boost?: number,
  style?: number,
  use_speaker_boost?: boolean,
  speed?: number,
  output_directory?: string,
  language?: string,
  output_format?: string
): any
// Convert text to speech

mcp__ElevenLabs__speech_to_text(
  input_file_path: string,
  language_code?: string,
  diarize?: boolean,
  save_transcript_to_file?: boolean,
  return_transcript_to_client_directly?: boolean,
  output_directory?: string
): any
// Transcribe audio to text

mcp__ElevenLabs__text_to_sound_effects(
  text: string,
  duration_seconds?: number,
  output_directory?: string,
  output_format?: string
): any
// Generate sound effects from text

mcp__ElevenLabs__search_voices(
  search?: string,
  sort?: "created_at_unix" | "name",
  sort_direction?: "asc" | "desc"
): any
// Search available voices

mcp__ElevenLabs__list_models(): any
// List available models

mcp__ElevenLabs__get_voice(
  voice_id: string
): any
// Get voice details

mcp__ElevenLabs__voice_clone(
  name: string,
  files: string[],
  description?: string
): any
// Clone voice from audio

mcp__ElevenLabs__isolate_audio(
  input_file_path: string,
  output_directory?: string
): any
// Isolate audio from file

mcp__ElevenLabs__check_subscription(): any
// Check subscription status

mcp__ElevenLabs__create_agent(
  name: string,
  first_message: string,
  system_prompt: string,
  voice_id?: string,
  language?: string,
  llm?: string,
  temperature?: number,
  max_tokens?: number,
  asr_quality?: string,
  model_id?: string,
  optimize_streaming_latency?: number,
  stability?: number,
  similarity_boost?: number,
  turn_timeout?: number,
  max_duration_seconds?: number,
  record_voice?: boolean,
  retention_days?: number
): any
// Create conversational AI agent

mcp__ElevenLabs__add_knowledge_base_to_agent(
  agent_id: string,
  knowledge_base_name: string,
  url?: string,
  input_file_path?: string,
  text?: string
): any
// Add knowledge base to agent

mcp__ElevenLabs__list_agents(): any
// List conversational agents

mcp__ElevenLabs__get_agent(
  agent_id: string
): any
// Get agent details

mcp__ElevenLabs__get_conversation(
  conversation_id: string
): any
// Get conversation transcript

mcp__ElevenLabs__list_conversations(
  agent_id?: string,
  cursor?: string,
  call_start_before_unix?: number,
  call_start_after_unix?: number,
  page_size?: number,
  max_length?: number
): any
// List agent conversations

mcp__ElevenLabs__speech_to_speech(
  input_file_path: string,
  voice_name?: string,
  output_directory?: string
): any
// Transform voice to another

mcp__ElevenLabs__text_to_voice(
  voice_description: string,
  text?: string,
  output_directory?: string
): any
// Create voice previews from prompt

mcp__ElevenLabs__create_voice_from_preview(
  generated_voice_id: string,
  voice_name: string,
  voice_description: string
): any
// Add generated voice to library

mcp__ElevenLabs__make_outbound_call(
  agent_id: string,
  agent_phone_number_id: string,
  to_number: string
): any
// Make outbound agent call

mcp__ElevenLabs__search_voice_library(
  search?: string,
  page?: number,
  page_size?: number
): any
// Search ElevenLabs voice library

mcp__ElevenLabs__list_phone_numbers(): any
// List account phone numbers

mcp__ElevenLabs__play_audio(
  input_file_path: string
): any
// Play audio file

# **Firecrawl** - *Advanced Web Scraping and Search with built-in agentic capabilities*

## ENV variable locations
**MCP Tools**
- @/Users/giannimunro/.claude.json
- @/Users/giannimunro/Desktop/cursor-projects/.mcp.json

**Local Host 3007 and 5007**
- @/Users/giannimunro/Desktop/cursor-projects/automation/UberEats-Image-Extractor/.env
- @/Users/giannimunro/Desktop/cursor-projects/automation/UberEats-Image-Extractor/.sdk-file-examples/config.js

**Local Host 3005 and 5005**
- @/Users/giannimunro/Desktop/UberEats Image Extractor/.env
- @/Users/giannimunro/Desktop/UberEats Image Extractor/.sdk-file-examples/config.js


mcp__firecrawl__firecrawl_scrape(
  url: string,
  formats?: string[],
  actions?: object[],
  excludeTags?: string[],
  extract?: object,
  includeTags?: string[],
  location?: object,
  maxAge?: number,
  mobile?: boolean,
  onlyMainContent?: boolean,
  removeBase64Images?: boolean,
  skipTlsVerification?: boolean,
  timeout?: number,
  waitFor?: number
): any
// Scrape single URL with advanced options

### Example Scrape Usage with FIRE-1 Agent
**{
  "name": "mcp__firecrawl__firecrawl_scrape",
  "arguments": {
    "url": "https://example.com",
    "formats": ["json"],
    "agent": {
      "model": "FIRE-1",
      "prompt": "Navigate through the page and extract the required data by clicking buttons or following links as needed."
    },
    "jsonOptions": {
      "schema": {
        "type": "object",
        "properties": {
          "company_name": {"type": "string"},
          "price": {"type": "number"}
        },
        "required": ["company_name", "price"]
      }
    }
  }
}**

mcp__firecrawl__firecrawl_map(
  url: string,
  ignoreSitemap?: boolean,
  includeSubdomains?: boolean,
  limit?: number,
  search?: string,
  sitemapOnly?: boolean
): any
// Discover all URLs on website

mcp__firecrawl__firecrawl_crawl(
  url: string,
  allowBackwardLinks?: boolean,
  allowExternalLinks?: boolean,
  deduplicateSimilarURLs?: boolean,
  excludePaths?: string[],
  ignoreQueryParameters?: boolean,
  ignoreSitemap?: boolean,
  includePaths?: string[],
  limit?: number,
  maxDepth?: number,
  scrapeOptions?: object,
  webhook?: string | object
): any
// Start async website crawl

mcp__firecrawl__firecrawl_check_crawl_status(
  id: string
): any
// Check crawl job status

mcp__firecrawl__firecrawl_search(
  query: string,
  country?: string,
  filter?: string,
  lang?: string,
  limit?: number,
  location?: object,
  scrapeOptions?: object,
  tbs?: string
): any
// Search web and scrape results

mcp__firecrawl__firecrawl_extract(
  urls: string[],
  prompt?: string,
  systemPrompt?: string,
  schema?: object,
  allowExternalLinks?: boolean,
  enableWebSearch?: boolean,
  includeSubdomains?: boolean
): any
// Extract structured data from pages

mcp__firecrawl__firecrawl_deep_research(
  query: string,
  maxDepth?: number,
  timeLimit?: number,
  maxUrls?: number
): any
// Deep web research with analysis

mcp__firecrawl__firecrawl_generate_llmstxt(
  url: string,
  maxUrls?: number,
  showFullText?: boolean
): any
// Generate LLMs.txt file