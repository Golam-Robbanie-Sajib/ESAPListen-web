'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

interface ProcessingConfig {
  role: string;
  output_fields: {
    transcript: boolean;
    summary_english: boolean;
    summary_arabic: boolean;
    action_items: boolean;
    deadlines: boolean;
    calendar_sync: boolean;
    budget_notes: boolean;
    decisions: boolean;
    general_notes: boolean;
  };
  user_input: string;
  custom_field_only: boolean;
}

interface ConfigContextType {
  config: ProcessingConfig;
  setConfig: (config: ProcessingConfig) => void;
  updateConfig: (updates: Partial<ProcessingConfig>) => void;
}

const DEFAULT_CONFIG: ProcessingConfig = {
  role: 'Custom',
  output_fields: {
    transcript: true,
    summary_english: true,
    summary_arabic: true,
    action_items: true,
    deadlines: true,
    calendar_sync: true,
    budget_notes: true,
    decisions: true,
    general_notes: true,
  },
  user_input: '',
  custom_field_only: false,
};

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfigState] = useState<ProcessingConfig>(DEFAULT_CONFIG);

  // Load config from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('processing_config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setConfigState(parsed);
      } catch (error) {
        console.error('Failed to parse saved config:', error);
      }
    }
  }, []);

  // Save config to localStorage whenever it changes
  const setConfig = (newConfig: ProcessingConfig) => {
    setConfigState(newConfig);
    localStorage.setItem('processing_config', JSON.stringify(newConfig));
  };

  const updateConfig = (updates: Partial<ProcessingConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
  };

  return (
    <ConfigContext.Provider value={{ config, setConfig, updateConfig }}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig() {
  const context = useContext(ConfigContext);
  if (context === undefined) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
}
