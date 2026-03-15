
import React from 'react';

interface InputFieldProps {
    label: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
}

export const InputField: React.FC<InputFieldProps> = ({ label, value, onChange, placeholder }) => {
    return (
        <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">{label}</label>
            <input
                type="text"
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200"
            />
        </div>
    );
};
