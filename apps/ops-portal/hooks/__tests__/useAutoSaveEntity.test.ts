import { renderHook, act, waitFor } from '@testing-library/react';
import { useAutoSaveEntity } from '../useAutoSaveEntity';
import { toast } from 'react-hot-toast';

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

interface TestEntity {
  id: string;
  name: string;
  description: string;
  category: string;
  events?: Array<{ id: string; name: string }>;
}

interface TestDto {
  name: string;
  description: string;
  category: string;
}

describe('useAutoSaveEntity', () => {
  const initialEntity: TestEntity = {
    id: 'ent-1',
    name: 'Initial Name',
    description: 'Initial Desc',
    category: 'Hardware',
    events: [{ id: 'evt-1', name: 'created' }],
  };

  let mockFetchFn: jest.Mock;
  let mockUpdateFn: jest.Mock;
  let mockOnRefresh: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchFn = jest.fn().mockResolvedValue({ data: { ...initialEntity } });
    mockUpdateFn = jest.fn().mockImplementation((id: string, dto: TestDto) =>
      Promise.resolve({ data: { ...initialEntity, ...dto } })
    );
    mockOnRefresh = jest.fn();
  });

  it('loads entity on mount and populates dto and entity', async () => {
    const { result } = renderHook(() =>
      useAutoSaveEntity<TestEntity, TestDto>({
        id: 'ent-1',
        fetchFn: mockFetchFn,
        updateFn: mockUpdateFn,
        onRefresh: mockOnRefresh,
      })
    );

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.entity).toEqual(initialEntity);
    expect(result.current.dto).toEqual({
      id: 'ent-1',
      name: 'Initial Name',
      description: 'Initial Desc',
      category: 'Hardware',
      events: [{ id: 'evt-1', name: 'created' }],
    });
    expect(mockFetchFn).toHaveBeenCalledWith('ent-1');
    expect(mockOnRefresh).toHaveBeenCalledWith(initialEntity);
  });

  it('updates field locally with updateField and marks isDirty', async () => {
    const { result } = renderHook(() =>
      useAutoSaveEntity<TestEntity, TestDto>({
        id: 'ent-1',
        fetchFn: mockFetchFn,
        updateFn: mockUpdateFn,
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.updateField('name', 'Updated Name');
    });

    expect(result.current.dto?.name).toBe('Updated Name');
    expect(result.current.isDirty).toBe(true);
  });

  it('does not invoke updateFn if value has not changed in saveField', async () => {
    const { result } = renderHook(() =>
      useAutoSaveEntity<TestEntity, TestDto>({
        id: 'ent-1',
        fetchFn: mockFetchFn,
        updateFn: mockUpdateFn,
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.saveField('name', 'Initial Name');
    });

    expect(mockUpdateFn).not.toHaveBeenCalled();
  });

  it('saves field, merges response and reloads timeline events', async () => {
    const { result } = renderHook(() =>
      useAutoSaveEntity<TestEntity, TestDto>({
        id: 'ent-1',
        fetchFn: mockFetchFn,
        updateFn: mockUpdateFn,
        onRefresh: mockOnRefresh,
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const refreshedEntity = {
      ...initialEntity,
      name: 'Saved Name',
      events: [
        { id: 'evt-1', name: 'created' },
        { id: 'evt-2', name: 'name_updated' },
      ],
    };

    mockFetchFn.mockResolvedValueOnce({ data: refreshedEntity });

    await act(async () => {
      await result.current.saveField('name', 'Saved Name');
    });

    expect(mockUpdateFn).toHaveBeenCalledWith(
      'ent-1',
      expect.objectContaining({ name: 'Saved Name' })
    );
    expect(toast.success).toHaveBeenCalledWith('Saved');
    expect(result.current.entity?.name).toBe('Saved Name');
    expect(result.current.entity?.events).toHaveLength(2);
    expect(result.current.isDirty).toBe(false);
  });

  it('does not clobber concurrent user typing on other fields during saveField background refresh', async () => {
    let resolveUpdate: (val: { data: TestEntity }) => void;
    mockUpdateFn.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUpdate = resolve;
        })
    );

    const { result } = renderHook(() =>
      useAutoSaveEntity<TestEntity, TestDto>({
        id: 'ent-1',
        fetchFn: mockFetchFn,
        updateFn: mockUpdateFn,
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Start saving 'name'
    let savePromise: Promise<void>;
    act(() => {
      savePromise = result.current.saveField('name', 'New Name');
    });

    expect(result.current.saving).toBe(true);

    // Concurrently, user types into 'description'
    act(() => {
      result.current.updateField('description', 'Concurrent Description Typing');
    });

    expect(result.current.dto?.description).toBe('Concurrent Description Typing');

    // Server finishes saving 'name'
    const savedEntity: TestEntity = {
      ...initialEntity,
      name: 'New Name',
      description: 'Initial Desc', // Server still has old description
    };
    mockFetchFn.mockResolvedValueOnce({ data: savedEntity });

    await act(async () => {
      resolveUpdate!({ data: savedEntity });
      await savePromise!;
    });

    expect(result.current.saving).toBe(false);
    // Verified: Concurrent edit to description was NOT overwritten by server's old description
    expect(result.current.dto?.name).toBe('New Name');
    expect(result.current.dto?.description).toBe('Concurrent Description Typing');
  });

  it('rolls back only the failed field on saveField error without destroying other edits', async () => {
    mockUpdateFn.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() =>
      useAutoSaveEntity<TestEntity, TestDto>({
        id: 'ent-1',
        fetchFn: mockFetchFn,
        updateFn: mockUpdateFn,
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Make local change to description
    act(() => {
      result.current.updateField('description', 'Kept Description');
    });

    // Attempt save on 'name' which fails
    await act(async () => {
      await result.current.saveField('name', 'Failed Name');
    });

    expect(toast.error).toHaveBeenCalled();
    // 'name' rolls back to initial server value 'Initial Name'
    expect(result.current.dto?.name).toBe('Initial Name');
    // 'description' is preserved!
    expect(result.current.dto?.description).toBe('Kept Description');
    expect(result.current.saving).toBe(false);
  });

  it('handleSave saves all dirty fields and reloads entity', async () => {
    const { result } = renderHook(() =>
      useAutoSaveEntity<TestEntity, TestDto>({
        id: 'ent-1',
        fetchFn: mockFetchFn,
        updateFn: mockUpdateFn,
        onRefresh: mockOnRefresh,
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.updateField('name', 'Manual Batch Name');
      result.current.updateField('category', 'Electronics');
    });

    expect(result.current.isDirty).toBe(true);

    const updatedEntity = {
      ...initialEntity,
      name: 'Manual Batch Name',
      category: 'Electronics',
    };
    mockFetchFn.mockResolvedValueOnce({ data: updatedEntity });

    await act(async () => {
      await result.current.handleSave();
    });

    expect(mockUpdateFn).toHaveBeenCalledWith(
      'ent-1',
      expect.objectContaining({
        name: 'Manual Batch Name',
        category: 'Electronics',
      })
    );
    expect(toast.success).toHaveBeenCalledWith('Saved');
    expect(result.current.isDirty).toBe(false);
  });
});
