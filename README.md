# AI Movie Recs
 
A smart movie recommendation app that takes a natural language prompt, parses it through a local Ollama LLM instance, and generates search queries to find similar movies using the TMDB API.
 
## Services Used
- [TMDB API](https://www.themoviedb.org/settings/api)
- Local Ollama LLM (Gemma4)
 
## How to Run
1. Clone the repo
2. Create a `.env` file and add your TMDB API key
3. Serve Ollama `ollama serve`
4. Run with Gemma4 `ollama run gemma4`
5. Run `npm start`