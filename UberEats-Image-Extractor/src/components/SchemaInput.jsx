// components/SchemaInput.jsx - Component for custom extraction schema input
import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { DEFAULT_SCHEMA, SCHEMA_OPTIONS } from '../services/firecrawl-service';
import '../styles/SchemaInput.css';

function SchemaInput({ value, onChange, disabled, selectedSchemaId, onSchemaSelect }) {
  const [error, setError] = useState(null);
  const [customMode, setCustomMode] = useState(false);
  
  // Update textarea when a preset schema is selected
  useEffect(() => {
    if (selectedSchemaId && !customMode) {
      const selectedOption = SCHEMA_OPTIONS.find(option => option.id === selectedSchemaId);
      if (selectedOption) {
        onChange(JSON.stringify(selectedOption.schema, null, 2));
      }
    }
  }, [selectedSchemaId, onChange, customMode]);
  
  const handleChange = (e) => {
    const newValue = e.target.value;
    onChange(newValue);
    setCustomMode(true);
    
    // Validate JSON syntax
    if (newValue.trim()) {
      try {
        JSON.parse(newValue);
        setError(null);
      } catch (err) {
        setError(`Invalid JSON: ${err.message}`);
      }
    } else {
      setError(null);
    }
  };
  
  const handleSchemaSelect = (e) => {
    const schemaId = e.target.value;
    
    if (schemaId === 'custom') {
      setCustomMode(true);
    } else {
      setCustomMode(false);
      onSchemaSelect(schemaId);
      
      // Find the selected schema option
      const selectedOption = SCHEMA_OPTIONS.find(option => option.id === schemaId);
      if (selectedOption) {
        onChange(JSON.stringify(selectedOption.schema, null, 2));
        setError(null);
      }
    }
  };
  
  const handleReset = () => {
    onChange(JSON.stringify(DEFAULT_SCHEMA, null, 2));
    onSchemaSelect('default');
    setCustomMode(false);
    setError(null);
  };
  
  return (
    <div className="schema-input">
      <div className="schema-input-header">
        <label htmlFor="extraction-schema">Extraction Schema</label>
        <div className="schema-actions">
          <button 
            type="button" 
            className="reset-button"
            onClick={handleReset}
            disabled={disabled}
          >
            Reset to Default
          </button>
        </div>
      </div>
      
      <div className="schema-selector">
        <select 
          value={customMode ? 'custom' : selectedSchemaId}
          onChange={handleSchemaSelect}
          disabled={disabled}
          className="schema-dropdown"
        >
          {SCHEMA_OPTIONS.map(option => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
          <option value="custom">Custom Schema</option>
        </select>
        <span className="dropdown-hint">Select a predefined schema or create a custom one</span>
      </div>
      
      <textarea
        id="extraction-schema"
        value={value}
        onChange={handleChange}
        placeholder="Enter custom extraction schema in JSON format..."
        rows={8}
        disabled={disabled}
        className={error ? 'error' : ''}
      />
      
      {error && (
        <div className="schema-error">
          {error}
        </div>
      )}
      
      <div className="schema-help">
        <p>
          The extraction schema defines the structure of the data to be extracted.
          {customMode && "It should be a valid JSON object that follows the JSONSchema specification."}
        </p>
        {customMode && (
          <details>
            <summary>Schema Structure</summary>
            <ul>
              <li>Use the <code>type</code> property to define data types</li>
              <li>Use <code>properties</code> to define object fields</li>
              <li>Use <code>items</code> to define array elements</li>
              <li>Use <code>required</code> to specify required fields</li>
            </ul>
            <p>Example: <code>{`{"type": "object", "properties": { "menuItems": { "type": "array" } }}`}</code></p>
          </details>
        )}
      </div>
    </div>
  );
}

SchemaInput.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  selectedSchemaId: PropTypes.string,
  onSchemaSelect: PropTypes.func
};

SchemaInput.defaultProps = {
  value: JSON.stringify(DEFAULT_SCHEMA, null, 2),
  disabled: false,
  selectedSchemaId: 'default',
  onSchemaSelect: () => {}
};

export default SchemaInput;