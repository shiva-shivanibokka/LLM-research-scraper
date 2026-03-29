# Research Paper Summarizer

A tool that fetches any research paper and generates a structured, plain-English summary using Claude (Anthropic). Instead of reading a dense 20-page academic paper, you give it a paper ID and get back a clean breakdown of what the paper is about, what problem it solves, what they found, and why it matters.

Built on top of concepts from Week 1 / Day 1 of the LLM Engineering course by Ed Donner.

---

## What Problem Does This Solve?

Research papers are written for other researchers. They are dense, jargon-heavy, and time-consuming to read. This tool fetches the paper's metadata and abstract from a free API and feeds it to Claude, which then produces a structured summary in plain English — so anyone can understand what a paper is about without reading the whole thing.

---

## Why Not Just Scrape the Website?

The original project used `requests` + `BeautifulSoup` to scrape websites. The problem with research sites like ResearchGate or Google Scholar is that **they actively block bots** — you get 403 errors or security checkpoints instead of the paper content.

The solution here is to skip scraping entirely and use **free, official APIs** that are designed to be accessed programmatically. No bot detection. No errors. Clean structured data every time.

---

## Data Sources

This project supports two sources. You can use either one depending on where the paper is published.

### arXiv
- A free, open repository of research papers in AI, ML, Computer Science, Math, Physics, and more
- Where most AI/ML papers are published first — including the original Transformer paper and GPT papers
- Provides: title, authors, abstract, subject categories
- No API key required
- Returns data in XML format

### Semantic Scholar
- A free academic search engine built by the Allen Institute for AI
- Indexes over 200 million papers across all fields — not just CS/ML
- Useful for papers in medicine, biology, economics, and anything not on arXiv
- Provides: title, authors, abstract, year, citation count, fields of study
- No API key required for basic usage (100 requests per 5 minutes)
- Returns data in JSON format

---

## What Claude Extracts From Each Paper

Every summary covers these 7 sections:

1. **What is this paper about?** — A plain-English explanation of the topic
2. **The problem they are solving** — What gap or challenge does this research address
3. **Their approach** — How the authors tackled the problem
4. **Key findings** — What they discovered or proved
5. **Why it matters** — The real-world impact or significance
6. **Limitations and future directions** — What the paper doesn't cover and what comes next
7. **Who should read this?** — What kind of person or professional would benefit most

---

## How It Works

```
You provide a paper ID (arXiv ID or Semantic Scholar ID)
    → The tool calls the free API and fetches paper metadata
        → The metadata is formatted into a clean text block
            → Claude reads it and generates a structured summary
                → The summary is displayed in the notebook as formatted markdown
```

---

## Project Structure

```
research_web_scraping/
├── research_summarizer.ipynb   # The single notebook — everything lives here
└── README.md                   # This file
```

All code is in one notebook to keep things simple and self-contained.

---

## Requirements

### Python packages

```bash
pip install anthropic python-dotenv requests
```

- `anthropic` — to call Claude for summarization
- `python-dotenv` — to load your API key from the `.env` file
- `requests` — to call the arXiv and Semantic Scholar APIs
- `xml.etree.ElementTree` — built into Python, used to parse arXiv's XML responses

### API Key

You need an Anthropic API key to run this. Get one at https://console.anthropic.com

Add it to the `.env` file at the root of the repository:

```
ANTHROPIC_API_KEY=sk-ant-...
```

The notebook loads this automatically using `load_dotenv()`. No other keys are needed — both arXiv and Semantic Scholar are free with no authentication required.

---

## How to Use It

### Using arXiv

Every arXiv paper has a URL like:
```
https://arxiv.org/abs/1706.03762
```

The ID is the last part: `1706.03762`

In the notebook, call:
```python
summarize_arxiv("1706.03762")
```

### Using Semantic Scholar

You have three options for the paper ID:

**Option 1 — Use an arXiv ID with a prefix** (easiest if you know the arXiv ID):
```python
summarize_semantic_scholar("ArXiv:1706.03762")
```

**Option 2 — Use a DOI** (useful for journal papers not on arXiv):
```python
summarize_semantic_scholar("DOI:10.1038/s41586-021-03819-2")
```

**Option 3 — Use the Semantic Scholar hash ID** (found at the end of the paper's URL on semanticscholar.org):
```python
summarize_semantic_scholar("204e3073870fae3d05bcbc2f6a8e263d9b72e776")
```

---

## Example Papers Included in the Notebook

| Paper | Source | ID |
|-------|--------|-----|
| Attention Is All You Need (Transformer) | arXiv | `1706.03762` |
| GPT-4 Technical Report | arXiv | `2303.08774` |
| Attention Is All You Need (with citation count) | Semantic Scholar | `ArXiv:1706.03762` |
| AlphaFold 2 (protein structure prediction) | Semantic Scholar via DOI | `DOI:10.1038/s41586-021-03819-2` |

---

## arXiv vs Semantic Scholar — When to Use Which

| | arXiv | Semantic Scholar |
|--|-------|-----------------|
| Best for | CS, AI, ML, Physics, Math | All fields including medicine, biology, economics |
| Extra data | Categories | Citation count, year, fields of study |
| Paper format | XML | JSON |
| Papers outside CS | Limited | Yes — 200M+ papers |
| Requires arXiv ID | Yes | No — also accepts DOI and its own hash ID |

Use **arXiv** if the paper is an AI/ML paper and you have the arXiv URL.
Use **Semantic Scholar** if the paper is outside CS, you only have a DOI, or you want citation counts.

---

## Frequently Asked Questions

**Do I need to pay for anything?**
Only for Claude (Anthropic API). Both arXiv and Semantic Scholar are completely free. Anthropic offers free credits when you sign up.

**What if I get a 403 error?**
That would only happen if you were scraping websites directly. This project uses official APIs, so you should never see a 403.

**What if Semantic Scholar returns an error?**
Double check the paper ID format. For arXiv IDs, make sure to include the `ArXiv:` prefix. For DOIs, include the `DOI:` prefix.

**Can I summarize papers from Google Scholar or ResearchGate?**
Not directly — those sites block bots. But if the paper is indexed on Semantic Scholar (most are), you can use the DOI to fetch it from there instead.

**What if the abstract is missing?**
Some papers on Semantic Scholar have no abstract available. The summary will still run but will be less detailed since Claude only has the title, authors, and metadata to work with.

