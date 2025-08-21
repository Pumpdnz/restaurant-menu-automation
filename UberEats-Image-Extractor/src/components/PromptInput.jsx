// components/PromptInput.jsx - Component for custom extraction prompt input
import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { DEFAULT_PROMPT, PROMPT_OPTIONS } from '../services/firecrawl-service';
import '../styles/PromptInput.css';

function PromptInput({ value, onChange, disabled, selectedPromptId, onPromptSelect, platformType }) {
  const [customMode, setCustomMode] = useState(false);
  
  // Update textarea when a preset prompt is selected
  useEffect(() => {
    if (selectedPromptId && !customMode) {
      const selectedOption = PROMPT_OPTIONS.find(option => option.id === selectedPromptId);
      if (selectedOption) {
        onChange(selectedOption.prompt);
      }
    }
  }, [selectedPromptId, onChange, customMode]);
  
  // Auto-select platform-specific prompt when platform is detected
  useEffect(() => {
    if (platformType && !customMode) {
      let promptId = 'default';
      
      if (platformType === 'ubereats') {
        promptId = 'ubereats';
      } else if (platformType === 'doordash') {
        promptId = 'doordash';
      }
      
      if (promptId !== selectedPromptId) {
        onPromptSelect(promptId);
      }
    }
  }, [platformType, onPromptSelect, selectedPromptId, customMode]);
  
  const handlePromptSelect = (e) => {
    const promptId = e.target.value;
    
    if (promptId === 'custom') {
      setCustomMode(true);
    } else {
      setCustomMode(false);
      onPromptSelect(promptId);
      
      // Find the selected prompt option
      const selectedOption = PROMPT_OPTIONS.find(option => option.id === promptId);
      if (selectedOption) {
        onChange(selectedOption.prompt);
      }
    }
  };
  
  const handleTextChange = (e) => {
    onChange(e.target.value);
    setCustomMode(true);
  };
  
  const handleReset = () => {
    onChange(DEFAULT_PROMPT);
    onPromptSelect('default');
    setCustomMode(false);
  };
  
  return (
    <div className="prompt-input">
      <div className="prompt-input-header">
        <label htmlFor="extraction-prompt">Extraction Prompt</label>
        <button 
          type="button" 
          className="reset-button"
          onClick={handleReset}
          disabled={disabled}
        >
          Reset to Default
        </button>
      </div>
      
      <div className="prompt-selector">
        <select 
          value={customMode ? 'custom' : selectedPromptId}
          onChange={handlePromptSelect}
          disabled={disabled}
          className="prompt-dropdown"
        >
          {PROMPT_OPTIONS.map(option => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
          <option value="custom">Custom Prompt</option>
        </select>
        <span className="dropdown-hint">
          {platformType ? `Recommended prompt for ${platformType} selected` : 'Select a predefined prompt or create a custom one'}
        </span>
      </div>
      
      <textarea
        id="extraction-prompt"
        value={value}
        onChange={handleTextChange}
        placeholder="Enter custom extraction prompt..."
        rows={6}
        disabled={disabled}
      />
      
      <div className="prompt-help">
        <p>
          The extraction prompt guides the Firecrawl agent in navigating and extracting
          data from the restaurant page. {platformType === 'doordash' && 'For DoorDash, the optimized prompts focus on extracting high-quality image URLs.'}
        </p>
        {customMode && (
          <details>
            <summary>Prompt Tips</summary>
            <ul>
              <li>Be specific about what data to extract</li>
              <li>Provide clear navigation instructions</li>
              <li>Mention any specific menu sections to focus on</li>
              <li>Include instructions to handle special cases (e.g., combos)</li>
              {platformType === 'doordash' && (
                <li>For DoorDash, include instructions to look for image URLs in data-src attributes and CSS background-image styles</li>
              )}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}

PromptInput.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  selectedPromptId: PropTypes.string,
  onPromptSelect: PropTypes.func,
  platformType: PropTypes.string
};

PromptInput.defaultProps = {
  value: DEFAULT_PROMPT,
  disabled: false,
  selectedPromptId: 'default',
  onPromptSelect: () => {},
  platformType: null
};

export default PromptInput;