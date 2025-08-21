// components/ErrorDisplay.jsx - Display error messages
import React from 'react';
import PropTypes from 'prop-types';
import '../styles/ErrorDisplay.css';

function ErrorDisplay({ message }) {
  return (
    <div className="error-display">
      <div className="error-icon">⚠️</div>
      <div className="error-message">{message}</div>
    </div>
  );
}

ErrorDisplay.propTypes = {
  message: PropTypes.string.isRequired
};

export default ErrorDisplay;