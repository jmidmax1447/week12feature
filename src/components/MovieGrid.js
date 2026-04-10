import React from 'react';

function MovieGrid({ movies }) {
  return (
    <div className="movie-grid">
      {(!movies || movies.length === 0) ? (
        <p className="no-movies">No movies loaded yet</p>
      ) : (
        <div className="grid-container">
          {movies.map((movie) => (
            <div key={movie.id} className="movie-card">
              {movie.poster ? (
                <img src={movie.poster} alt={movie.title} className="movie-poster" />
              ) : (
                <div className="movie-poster-placeholder">No poster available</div>
              )}
              <h3 className="movie-title">{movie.title}</h3>
              <p className="movie-rating">⭐ {movie.rating}</p>
              <p className="movie-release">({movie.releaseDate})</p>
              <p className="movie-overview">{movie.overview}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default MovieGrid;
