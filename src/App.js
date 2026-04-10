import { useState } from 'react';
import './App.css';
import SearchBar from './components/SearchBar';
import MovieGrid from './components/MovieGrid';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_POSTER_BASE = 'https://image.tmdb.org/t/p/w500';
const OLLAMA_BASE_URL = 'http://localhost:11434';
const OLLAMA_API_URL = `${OLLAMA_BASE_URL}/api/generate`;

// TMDB Genre ID mapping
const GENRE_MAP = {
  'action': 28,
  'adventure': 12,
  'animation': 16,
  'comedy': 35,
  'crime': 80,
  'documentary': 99,
  'drama': 18,
  'family': 10751,
  'fantasy': 14,
  'history': 36,
  'horror': 27,
  'music': 10402,
  'mystery': 9648,
  'romance': 10749,
  'sci-fi': 878,
  'science fiction': 878,
  'thriller': 53,
  'war': 10752,
  'western': 37,
};

// Common movie keywords mapping
const KEYWORD_MAP = {
  'dark': 'dark',
  'psychological': 'psychological',
  'mindbending': 'mindbending',
  'emotional': 'emotional',
  'intense': 'intense',
  'supernatural': 'supernatural',
  'suspense': 'suspense',
  'action-packed': 'action',
  'funny': 'comedy',
  'hilarious': 'comedy',
  'witty': 'witty',
  'romantic': 'romance',
  'heartwarming': 'heartwarming',
  'adventure': 'adventure',
  'thrilling': 'thrilling',
};

// Test if Ollama is running
const testOllamaConnection = async () => {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      method: 'GET',
    });
    return response.ok;
  } catch (error) {
    console.error('Ollama connection test failed:', error.message);
    return false;
  }
};

const analyzeQueryWithOllama = async (query) => {
  // Test connection first
  const isConnected = await testOllamaConnection();
  if (!isConnected) {
    throw new Error(
      'Ollama server is not running. Please start Ollama with: ollama serve\n' +
      'Make sure it\'s running on http://localhost:11434'
    );
  }

  const prompt = `You are a movie recommendation expert. Analyze this user request and return ONLY a valid JSON object (no markdown, no extra text, no explanations) in this exact format:
{
  "referencedMovie": "exact title of the referenced movie if any (e.g. 'Inception', 'The Matrix'), empty string if none mentioned",
  "searchQuery": "main search term if no specific movie, empty string if specific movie referenced",
  "genre": "primary genre name (action, comedy, drama, horror, sci-fi, thriller, romance, adventure, etc), empty string if not identifiable",
  "mood": "mood or tone (dark, light, intense, heartwarming, funny, etc), empty string if not identifiable",
  "keywords": ["list", "of", "tone", "and", "theme", "keywords"]
}

CRITICAL RULES:
1. If user mentions/references a SPECIFIC MOVIE (e.g., "like Inception", "similar to The Matrix"), extract ONLY that movie title as "referencedMovie"
2. If no specific movie is referenced, leave "referencedMovie" empty and put the search term in "searchQuery"
3. Extract actual genre names, not descriptions
4. Extract mood/tone words clearly
5. Keywords should capture the feeling/theme/tone
6. DO NOT guess - only extract a referencedMovie if the user explicitly mentions a specific movie title

User request: "${query}"

Return ONLY the JSON object, nothing else. Start with { and end with }`;

  try {
    console.log('Calling Ollama API at', OLLAMA_API_URL);

    const response = await fetch(OLLAMA_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gemma4',
        prompt: prompt,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Ollama error response:', response.status, errorBody);
      throw new Error(
        `Ollama API error: ${response.status}. ` +
        `Make sure the "gemma4" model is installed. ` +
        `Run: ollama pull gemma4`
      );
    }

    const data = await response.json();

    if (!data.response) {
      throw new Error('Invalid Ollama response format');
    }

    const responseText = data.response;
    console.log('Ollama response:', responseText);

    // Extract JSON from response (in case there's extra text)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse JSON from Ollama response');
    }

    const analysisResult = JSON.parse(jsonMatch[0]);

    return {
      referencedMovie: analysisResult.referencedMovie || '',
      searchQuery: analysisResult.searchQuery || query,
      genre: analysisResult.genre || '',
      mood: analysisResult.mood || '',
      keywords: Array.isArray(analysisResult.keywords) ? analysisResult.keywords : [],
    };
  } catch (error) {
    console.warn('Ollama analysis failed, falling back to raw query:', error.message);
    // Fallback: return the raw query
    return {
      referencedMovie: '',
      searchQuery: query,
      genre: '',
      mood: '',
      keywords: [],
    };
  }
};

// Get movie ID from TMDB by searching for the title
const getMovieIdByTitle = async (movieTitle, apiKey) => {
  const searchUrl = `${TMDB_BASE_URL}/search/movie?api_key=${apiKey}&query=${encodeURIComponent(movieTitle)}`;
  console.log('Searching for movie ID:', movieTitle);

  const response = await fetch(searchUrl);
  if (!response.ok) {
    throw new Error(`TMDB search error: ${response.status}`);
  }

  const data = await response.json();
  if (!data.results || data.results.length === 0) {
    throw new Error(`Movie "${movieTitle}" not found on TMDB`);
  }

  // Return the first (most relevant) result
  return data.results[0].id;
};

// Get similar movies for a specific movie ID
const getSimilarMovies = async (movieId, apiKey) => {
  const similarUrl = `${TMDB_BASE_URL}/movie/${movieId}/similar?api_key=${apiKey}&sort_by=popularity.desc`;
  console.log('Fetching similar movies for ID:', movieId);

  const response = await fetch(similarUrl);
  if (!response.ok) {
    throw new Error(`TMDB similar endpoint error: ${response.status}`);
  }

  const data = await response.json();
  return data.results;
};

const searchMovies = async (analysisData) => {
  const apiKey = process.env.REACT_APP_TMDB_API_KEY;

  if (!apiKey) {
    throw new Error('TMDB API key is not configured. Please add REACT_APP_TMDB_API_KEY to your .env file.');
  }

  // Priority 1: If a specific movie is referenced, use the similar endpoint
  if (analysisData.referencedMovie && analysisData.referencedMovie.trim()) {
    try {
      const movieId = await getMovieIdByTitle(analysisData.referencedMovie, apiKey);
      const results = await getSimilarMovies(movieId, apiKey);
      console.log(`Found ${results.length} movies similar to "${analysisData.referencedMovie}"`);
      return results;
    } catch (error) {
      console.warn(`Failed to find similar movies: ${error.message}. Falling back to genre/keyword search.`);
      // Fall through to genre/keyword search
    }
  }

  // Priority 2: If we have genre or keywords, use discover endpoint with filters
  if ((analysisData.genre && analysisData.genre.toLowerCase() in GENRE_MAP) || (analysisData.keywords && analysisData.keywords.length > 0)) {
    let discoverUrl = `${TMDB_BASE_URL}/discover/movie?api_key=${apiKey}&sort_by=popularity.desc`;

    // Add genre filter if we have a valid genre
    if (analysisData.genre && analysisData.genre.toLowerCase() in GENRE_MAP) {
      const genreId = GENRE_MAP[analysisData.genre.toLowerCase()];
      discoverUrl += `&with_genres=${genreId}`;
      console.log(`Filtering by genre: ${analysisData.genre} (ID: ${genreId})`);
    }

    // Add keywords filter if we have keywords
    if (analysisData.keywords && analysisData.keywords.length > 0) {
      const mappedKeywords = analysisData.keywords
        .filter((keyword) => keyword.toLowerCase() in KEYWORD_MAP)
        .map((keyword) => KEYWORD_MAP[keyword.toLowerCase()])
        .slice(0, 3); // Limit to 3 keywords to avoid over-filtering

      if (mappedKeywords.length > 0) {
        discoverUrl += `&with_keywords=${mappedKeywords.join('|')}`;
        console.log('Filtering by keywords:', mappedKeywords);
      }
    }

    console.log('Using discover endpoint:', discoverUrl.replace(apiKey, '[API_KEY]'));
    const response = await fetch(discoverUrl);

    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status}`);
    }

    const data = await response.json();
    return data.results;
  }

  // Priority 3: Fallback to text search with searchQuery
  if (analysisData.searchQuery && analysisData.searchQuery.trim()) {
    const searchUrl = `${TMDB_BASE_URL}/search/movie?api_key=${apiKey}&query=${encodeURIComponent(analysisData.searchQuery)}&sort_by=popularity`;
    console.log('Using search endpoint:', searchUrl.replace(apiKey, '[API_KEY]'));

    const response = await fetch(searchUrl);

    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status}`);
    }

    const data = await response.json();
    return data.results;
  }

  // If we reach here, no search method was available
  throw new Error('No search criteria provided');
};

function transformMovieData(results) {
  return results.map((movie) => ({
    id: movie.id,
    title: movie.title,
    poster: movie.poster_path ? `${TMDB_POSTER_BASE}${movie.poster_path}` : null,
    rating: movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A',
    overview: movie.overview || 'No overview available',
    releaseDate: movie.release_date || 'Unknown',
  }));
}

function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(null); // null, 'analyzing', 'searching', 'loading'
  const [error, setError] = useState(null);
  const [analysisInfo, setAnalysisInfo] = useState(null);

  const handleSearch = async (query) => {
    setSearchQuery(query);
    setMovies([]);
    setError(null);
    setAnalysisInfo(null);
    setLoading('analyzing');

    try {
      // Step 1: Analyze query with Ollama
      const analysis = await analyzeQueryWithOllama(query);
      setAnalysisInfo(analysis);

      // Step 2: Use structured filters to search TMDB
      setLoading('searching');
      const results = await searchMovies(analysis);
      
      // Step 3: Transform and load results
      setLoading('loading');
      const transformedResults = transformMovieData(results);
      setMovies(transformedResults);
      if (transformedResults.length === 0) {
        setError('No movies found. Try a different search.');
      }
    } catch (err) {
      setError(err.message);
      setMovies([]);
    } finally {
      setLoading(null);
    }
  };

  const getLoadingMessage = () => {
    switch (loading) {
      case 'analyzing':
        return '🤖 Analyzing your request with AI...';
      case 'searching':
        return '🔍 Searching for movies...';
      case 'loading':
        return '⏳ Loading results...';
      default:
        return '';
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Movie Recommendation Engine</h1>
        <p className="subtitle">AI-powered movie discovery using local Ollama LLM</p>
      </header>
      <main>
        <SearchBar onSearch={handleSearch} />
        {loading && <p className="loading">{getLoadingMessage()}</p>}
        {error && <p className="error">❌ {error}</p>}
        {analysisInfo && (analysisInfo.genre || analysisInfo.mood) && (
          <div className="analysis-info">
            {analysisInfo.genre && <span className="badge">Genre: {analysisInfo.genre}</span>}
            {analysisInfo.mood && <span className="badge">Mood: {analysisInfo.mood}</span>}
          </div>
        )}
        <MovieGrid movies={movies} />
      </main>
    </div>
  );
}

export default App;
