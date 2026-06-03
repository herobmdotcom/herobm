import React from 'react';
import { FormField } from './shared/FormField';

export interface DynamicFormProps {
  // modbm-allow-record-any
  schema: Record<string, any>;
  // modbm-allow-record-any
  data: Record<string, any>;
  // modbm-allow-record-any
  onChange: (data: Record<string, any>) => void;
  readOnly?: boolean;
}

/**
 * A lightweight DynamicForm component that parses a subset of JSON Schema.
 * It currently supports flat objects with string, number, and boolean properties.
 */
export const DynamicForm: React.FC<DynamicFormProps> = ({ schema, data, onChange, readOnly }) => {
  if (!schema || schema.type !== 'object' || !schema.properties) {
    return null; // Return nothing if the schema isn't a valid object schema
  }

  const handleChange = (key: string, value: any) => {
    if (readOnly) return;
    onChange({ ...data, [key]: value });
  };

  const properties = schema.properties;
  const required = schema.required || [];

  return (
    <div className="flex flex-col gap-4">
      {Object.entries(properties).map(([key, propSchema]: [string, any]) => {
        const isRequired = required.includes(key);
        const title = propSchema.title || key;
        const val = data[key] ?? '';
        let type = propSchema.type;
        if (propSchema.enum) type = 'enum';

        return (
          <FormField
            key={key}
            type={type}
            title={title}
            value={val}
            onChange={(newVal) => handleChange(key, newVal)}
            required={isRequired}
            readOnly={readOnly}
            options={propSchema.enum}
            description={propSchema.description}
          />
        );
      })}
    </div>
  );
};
