import React, { useState } from 'react';

function SearchBar({ onSearch }) {
  const [query, setQuery] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query);
      setQuery('');
    }
  };

  return (
    <div className="search-bar">
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Enter a movie request (e.g. 'dark sci-fi like Inception')"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit">Search Movies</button>
      </form>
    </div>
  );
}

export default SearchBar;
