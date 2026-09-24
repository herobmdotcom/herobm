import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NotesSection from '../NotesSection';

describe('NotesSection component', () => {
  it('does NOT render an empty "no notes" placeholder card when notes list is empty', () => {
    render(
      <NotesSection
        notes={[]}
        onAddNote={jest.fn()}
      />
    );

    expect(screen.queryByText(/no notes/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Note' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Type a note...')).toBeInTheDocument();
  });

  it('renders notes when provided and displays author and date', () => {
    const mockNotes = [
      {
        noteId: 'note-1',
        content: 'First test note content',
        createdOn: '2026-01-10T12:00:00Z',
        createdBy: { displayName: 'Alice Engineer' },
      },
      {
        noteId: 'note-2',
        content: 'Second test note content',
        createdOn: '2026-01-11T14:00:00Z',
        createdById: 'user-bob',
      },
    ];

    render(
      <NotesSection
        notes={mockNotes}
        onAddNote={jest.fn()}
      />
    );

    expect(screen.getByText('First test note content')).toBeInTheDocument();
    expect(screen.getByText('By: Alice Engineer')).toBeInTheDocument();
    expect(screen.getByText('Second test note content')).toBeInTheDocument();
    expect(screen.getByText('By: user-bob')).toBeInTheDocument();
  });

  it('calls onAddNote when clicking Add Note and clears textarea', async () => {
    const handleAdd = jest.fn().mockResolvedValue(undefined);
    render(
      <NotesSection
        notes={[]}
        onAddNote={handleAdd}
      />
    );

    const textarea = screen.getByPlaceholderText('Type a note...');
    fireEvent.change(textarea, { target: { value: 'New awesome note' } });

    const addBtn = screen.getByRole('button', { name: 'Add Note' });
    fireEvent.click(addBtn);

    await waitFor(() => {
      expect(handleAdd).toHaveBeenCalledWith('New awesome note');
      expect(textarea).toHaveValue('');
    });
  });

  it('calls onDeleteNote when clicking delete button on note item', () => {
    const handleDelete = jest.fn();
    const mockNotes = [
      {
        noteId: 'note-1',
        content: 'Deletable note',
        createdOn: '2026-01-10T12:00:00Z',
      },
    ];

    render(
      <NotesSection
        notes={mockNotes}
        onAddNote={jest.fn()}
        onDeleteNote={handleDelete}
        isEditable={true}
      />
    );

    const deleteBtn = screen.getByTitle('Delete note');
    fireEvent.click(deleteBtn);
    expect(handleDelete).toHaveBeenCalledWith('note-1');
  });
});
