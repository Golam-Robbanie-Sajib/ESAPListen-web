'use client';

import { useState } from 'react';
import { X, User, Settings } from 'lucide-react';
import { useConfig } from '@/lib/config-context';

const PRESET_CONFIGS = {
  'HR Manager': {
    role: 'HR Manager',
    output_fields: {
      transcript: true,
      summary_english: true,
      summary_arabic: false,
      action_items: true,
      deadlines: true,
      calendar_sync: true,
      budget_notes: false,
      decisions: true,
      general_notes: true,
    },
  },
  'Sales Manager': {
    role: 'Sales Manager',
    output_fields: {
      transcript: true,
      summary_english: true,
      summary_arabic: false,
      action_items: true,
      deadlines: true,
      calendar_sync: true,
      budget_notes: true,
      decisions: true,
      general_notes: false,
    },
  },
  'Project Manager': {
    role: 'Project Manager',
    output_fields: {
      transcript: true,
      summary_english: true,
      summary_arabic: false,
      action_items: true,
      deadlines: true,
      calendar_sync: true,
      budget_notes: true,
      decisions: true,
      general_notes: true,
    },
  },
  'Executive': {
    role: 'Executive',
    output_fields: {
      transcript: false,
      summary_english: true,
      summary_arabic: false,
      action_items: true,
      deadlines: true,
      calendar_sync: false,
      budget_notes: true,
      decisions: true,
      general_notes: false,
    },
  },
  'Custom': {
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
  },
};

interface RoleConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function RoleConfigModal({ isOpen, onClose }: RoleConfigModalProps) {
  const { config, setConfig, updateConfig } = useConfig();
  const [localConfig, setLocalConfig] = useState(config);

  if (!isOpen) return null;

  const handlePresetSelect = (presetName: string) => {
    const presetConfig = PRESET_CONFIGS[presetName as keyof typeof PRESET_CONFIGS];
    if (presetConfig) {
      setLocalConfig({
        ...localConfig,
        role: presetConfig.role,
        output_fields: presetConfig.output_fields,
      });
    }
  };

  const handleSave = () => {
    setConfig(localConfig);
    onClose();
  };

  const handleCancel = () => {
    setLocalConfig(config); // Reset to saved config
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <User className="w-6 h-6 text-indigo-600" />
            <h2 className="text-2xl font-bold text-gray-900">Role & Configuration</h2>
          </div>
          <button
            onClick={handleCancel}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Presets Selection */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-indigo-600" />
              Role Presets
            </h3>
            <div className="space-y-2">
              {['HR Manager', 'Sales Manager', 'Project Manager', 'Executive', 'Custom'].map(
                (role) => (
                  <button
                    key={role}
                    onClick={() => handlePresetSelect(role)}
                    className={`w-full text-left px-4 py-3 rounded-md transition-colors ${
                      localConfig.role === role
                        ? 'bg-indigo-100 text-indigo-700 font-medium border-2 border-indigo-500'
                        : 'hover:bg-gray-100 text-gray-700 border-2 border-transparent'
                    }`}
                  >
                    {role}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Output Fields Configuration */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5 text-indigo-600" />
              Output Fields
            </h3>
            <div className="space-y-3">
              {Object.entries(localConfig.output_fields).map(([key, value]) => (
                <label key={key} className="flex items-center space-x-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={(e) =>
                      setLocalConfig({
                        ...localConfig,
                        output_fields: {
                          ...localConfig.output_fields,
                          [key]: e.target.checked,
                        },
                      })
                    }
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-700 capitalize group-hover:text-gray-900">
                    {key.replace(/_/g, ' ')}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mt-8 pt-6 border-t border-gray-200">
          <button
            onClick={handleCancel}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
          >
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
}
