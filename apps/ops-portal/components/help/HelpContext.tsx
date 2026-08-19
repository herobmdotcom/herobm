'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { customFetch } from '@herobm/sdk';
import {
  HelpTopic,
  HelpContextResponse,
  HelpTopicSummary,
  HelpSearchResult,
} from './HelpTypes';

interface HelpContextValue {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  toggleHelp: () => void;
  openHelp: (topicId?: string) => void;
  closeHelp: () => void;
  activeTab: 'context' | 'toc' | 'search';
  setActiveTab: (tab: 'context' | 'toc' | 'search') => void;
  contextTopic: HelpTopic | null;
  activeTopic: HelpTopic | null;
  relatedTopics: Array<{ id: string; title: string; category?: string }>;
  topics: HelpTopicSummary[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  searchResults: HelpSearchResult[];
  isLoading: boolean;
  selectTopic: (id: string) => Promise<void>;
  navigateBackToContext: () => void;
}

const HelpContext = createContext<HelpContextValue | undefined>(undefined);

export function HelpProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'context' | 'toc' | 'search'>('context');
  
  const [contextTopic, setContextTopic] = useState<HelpTopic | null>(null);
  const [activeTopic, setActiveTopic] = useState<HelpTopic | null>(null);
  const [relatedTopics, setRelatedTopics] = useState<Array<{ id: string; title: string; category?: string }>>([]);
  const [topics, setTopics] = useState<HelpTopicSummary[]>([]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<HelpSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch contextual topic when pathname changes
  const fetchContextHelp = useCallback(async (path: string) => {
    try {
      setIsLoading(true);
      const res = await customFetch<{ data: HelpContextResponse }>(
        `/help/context?route=${encodeURIComponent(path)}`,
        { method: 'GET' },
      );
      const contextData = res?.data;
      setContextTopic(contextData?.topic ?? null);
      setRelatedTopics(contextData?.relatedTopics ?? []);
      // If user hasn't drilled into a custom topic, keep active topic in sync with context
      setActiveTopic(contextData?.topic ?? null);
    } catch {
      setContextTopic(null);
      setActiveTopic(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch table of contents topics
  const fetchAllTopics = useCallback(async () => {
    try {
      const res = await customFetch<{ data: HelpTopicSummary[] }>('/help/topics', {
        method: 'GET',
      });
      setTopics(res?.data ?? []);
    } catch {
      setTopics([]);
    }
  }, []);

  // Sync context on route changes
  useEffect(() => {
    if (pathname) {
      fetchContextHelp(pathname);
    }
  }, [pathname, fetchContextHelp]);

  // Load all topics whenever help drawer is opened
  useEffect(() => {
    if (isOpen) {
      fetchAllTopics();
    }
  }, [isOpen, fetchAllTopics]);

  // Handle live search debouncing
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await customFetch<{ data: HelpSearchResult[] }>(
          `/help/search?q=${encodeURIComponent(searchQuery.trim())}`,
          { method: 'GET' },
        );
        setSearchResults(res?.data ?? []);
      } catch {
        setSearchResults([]);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Global keyboard shortcuts (F1 or '?' when not typing)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if (e.key === 'F1') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === '?' && !isInput && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const selectTopic = useCallback(async (id: string) => {
    try {
      setIsLoading(true);
      const res = await customFetch<{ data: HelpTopic }>(
        `/help/topics/${encodeURIComponent(id)}`,
        { method: 'GET' },
      );
      setActiveTopic(res?.data ?? null);
      setActiveTab('context');
    } catch {
      // Failed to load topic
    } finally {
      setIsLoading(false);
    }
  }, []);

  const navigateBackToContext = useCallback(() => {
    setActiveTopic(contextTopic);
    setActiveTab('context');
  }, [contextTopic]);

  const openHelp = useCallback((topicId?: string) => {
    setIsOpen(true);
    if (topicId) {
      selectTopic(topicId);
    } else {
      setActiveTopic(contextTopic);
      setActiveTab('context');
    }
  }, [contextTopic, selectTopic]);

  const closeHelp = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggleHelp = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  return (
    <HelpContext.Provider
      value={{
        isOpen,
        setIsOpen,
        toggleHelp,
        openHelp,
        closeHelp,
        activeTab,
        setActiveTab,
        contextTopic,
        activeTopic,
        relatedTopics,
        topics,
        searchQuery,
        setSearchQuery,
        searchResults,
        isLoading,
        selectTopic,
        navigateBackToContext,
      }}
    >
      {children}
    </HelpContext.Provider>
  );
}

const defaultHelpContextValue: HelpContextValue = {
  isOpen: false,
  setIsOpen: () => {},
  toggleHelp: () => {},
  openHelp: () => {},
  closeHelp: () => {},
  activeTab: 'context',
  setActiveTab: () => {},
  contextTopic: null,
  activeTopic: null,
  relatedTopics: [],
  topics: [],
  searchQuery: '',
  setSearchQuery: () => {},
  searchResults: [],
  isLoading: false,
  selectTopic: async () => {},
  navigateBackToContext: () => {},
};

export function useHelp() {
  const context = useContext(HelpContext);
  return context ?? defaultHelpContextValue;
}

