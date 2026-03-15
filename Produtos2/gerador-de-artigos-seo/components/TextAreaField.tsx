
import React from 'react';

interface TextAreaFieldProps {
    label: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    placeholder?: string;
    rows?: number;
}

export const TextAreaField: React.FC<TextAreaFieldProps> = ({ label, value, onChange, placeholder, rows = 5 }) => {
    return (
        <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">{label}</label>
            <textarea
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                rows={rows}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 resize-y"
            />
        </div>
    );
};
