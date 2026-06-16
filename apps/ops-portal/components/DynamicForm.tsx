import React from 'react';
import { FormField } from './shared/FormField';

export interface DynamicFormProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
  schema: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
  data: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
  const handleChange = (key: string, value: any) => {
    if (readOnly) return;
    onChange({ ...data, [key]: value });
  };

  const properties = schema.properties;
  const required = schema.required || [];

  return (
    <div className="flex flex-col gap-4">
      {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
        Object.entries(properties).map(([key, propSchema]: [string, any]) => {
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
