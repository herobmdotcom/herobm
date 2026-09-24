'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { ContentPageHeader } from '@/components/shared/ContentPageHeader';
import { Button } from '@/components/shared/Button';
import BarcodeScannerCard, {
  type BarcodeScannerSearchResult,
  type BarcodeScannerFeedback,
} from '@/components/shared/BarcodeScannerCard';
import { useAuth } from '@/components/AuthGate';
import { SystemResource, hasPermission, getErrorMessage, compareBinNumbers, STOCKTAKE_STATE } from '@herobm/shared';
import * as api from '@herobm/sdk';
import { reportError } from '@/lib/api';
import { toast } from 'react-hot-toast';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { routes } from '@/lib/routes';

import type {
  StocktakeItem,
  StocktakeBin,
  StocktakeFilter,
} from './types';
import { useStocktakeAudio } from './useStocktakeAudio';
import StocktakeLineItem, { getCountStatus } from './components/StocktakeLineItem';
import BinNavigatorCard from './components/BinNavigatorCard';
import BinOverviewDrawer from './components/BinOverviewDrawer';
import StocktakeReviewModal from './components/StocktakeReviewModal';
import CameraBarcodeScannerModal from './components/CameraBarcodeScannerModal';
import AddUnlistedProductModal, {
  type ProductSearchResult,
} from './components/AddUnlistedProductModal';
import StocktakeStickyFooter from './components/StocktakeStickyFooter';

interface RawProductSearchResult {
  productId: string;
  productNumber: string;
  productType?: string;
  name?: string;
  barcode?: string | null;
  alternateProductNumber?: string | null;
  imagePath?: string | null;
  description?: string | null;
  baseUom?: string | null;
}

export function matchBinPrefix(
  bin: { binNumber: string; zoneCode?: string },
  prefix: string,
  locationCode?: string,
): boolean {
  const p = prefix.trim();
  if (!p) return true;

  let cleanPrefix = p;
  if (locationCode && cleanPrefix.toUpperCase().startsWith(`${locationCode.toUpperCase()}.`)) {
    cleanPrefix = cleanPrefix.slice(locationCode.length + 1);
  }

  const upper = cleanPrefix.toUpperCase();
  const binUpper = bin.binNumber.toUpperCase();
  const zoneUpper = (bin.zoneCode || '').toUpperCase();
  const fullLocBin = locationCode ? `${locationCode.toUpperCase()}.${binUpper}` : '';

  return (
    binUpper.startsWith(upper) ||
    zoneUpper.startsWith(upper) ||
    (fullLocBin ? fullLocBin.startsWith(upper) : false)
  );
}

export const matchBinPattern = matchBinPrefix;

const SOUND_STORAGE_KEY = 'herobm_stocktake_sound_enabled';
const BLIND_COUNT_STORAGE_KEY = 'herobm_stocktake_blind_count_enabled';
const VIBRATE_STORAGE_KEY = 'herobm_stocktake_vibrate_enabled';

interface StocktakeClientProps {
  stocktakeId: string;
}

export default function StocktakeClient({ stocktakeId }: StocktakeClientProps) {
  const router = useRouter();
  const t = useTranslations('stocktake');
  const tDetail = useTranslations('stocktakes.detail');
  const tActions = useTranslations('stocktakes.actions');
  const tCommon = useTranslations('common');
  const { permissions } = useAuth();
  const canWrite = hasPermission(permissions, SystemResource.INVENTORY, 'write');

  const {
    playSuccess,
    playError,
    playBinSwitch,
    vibrateSuccess,
    vibrateError,
    vibrateBinSwitch,
  } = useStocktakeAudio();

  // Stocktake Entity State
  const [stocktakeEntity, setStocktakeEntity] = useState<api.StocktakeResponseDto | null>(null);
  const [locationBins, setLocationBins] = useState<StocktakeBin[]>([]);
  const [selectedZone, setSelectedZone] = useState<string>('all');
  const [binPattern, setBinPattern] = useState<string>('');
  const [selectedBinId, setSelectedBinId] = useState<string>('');
  const [selectedBinNumber, setSelectedBinNumber] = useState<string>('');

  // Loading States
  const [isLoadingStocktake, setIsLoadingStocktake] = useState(true);
  const [isLoadingItems, setIsLoadingItems] = useState(false);

  // Active Bin Items & Filter State
  const [items, setItems] = useState<StocktakeItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<StocktakeFilter>('all');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [confirmedEmptyBinIds, setConfirmedEmptyBinIds] = useState<string[]>([]);

  // User Preferences
  const [isBlindCount, setIsBlindCount] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(BLIND_COUNT_STORAGE_KEY);
      if (saved !== null) return saved === 'true';
    }
    return false;
  });
  const [isSoundEnabled, setIsSoundEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(SOUND_STORAGE_KEY);
      if (saved !== null) return saved === 'true';
    }
    return true;
  });
  const [isVibrateEnabled, setIsVibrateEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(VIBRATE_STORAGE_KEY);
      if (saved !== null) return saved === 'true';
    }
    return true;
  });
  const [feedback, setFeedback] = useState<BarcodeScannerFeedback | null>(null);

  // Completion State
  const [isCompleted, setIsCompleted] = useState(false);
  const [completedSummary, setCompletedSummary] = useState<{
    adjustedCount: number;
    reason: string;
  } | null>(null);

  // Persist user preferences to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(BLIND_COUNT_STORAGE_KEY, String(isBlindCount));
    }
  }, [isBlindCount]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(SOUND_STORAGE_KEY, String(isSoundEnabled));
    }
  }, [isSoundEnabled]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(VIBRATE_STORAGE_KEY, String(isVibrateEnabled));
    }
  }, [isVibrateEnabled]);

  // Scanner & Modal States
  const [isProcessingBarcode, setIsProcessingBarcode] = useState(false);
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isAddUnlistedOpen, setIsAddUnlistedOpen] = useState(false);
  const [isBinOverviewOpen, setIsBinOverviewOpen] = useState(false);

  // 1. Fetch Stocktake Entity & Location Bins on Mount
  useEffect(() => {
    if (!stocktakeId) return;

    let isMounted = true;
    async function loadStocktake() {
      setIsLoadingStocktake(true);
      try {
        const stRes = await api.stocktakesControllerFindOne(stocktakeId);
        const st = stRes.data;

        if (!isMounted) return;
        setStocktakeEntity(st);
        setIsBlindCount(Boolean(st.isBlindCount));

        if (st.scopeType === 'zone' && st.zoneFilter) {
          setSelectedZone(st.zoneFilter);
        } else if (st.scopeType === 'bin_pattern' && st.binPattern) {
          setBinPattern(st.binPattern);
        }

        // Fetch location bins
        const binsRes = await api.inventoryControllerFindBinsByLocation(st.locationId, {});
        const rawBins = binsRes.data as unknown;
        const b = (Array.isArray(rawBins) ? rawBins : (rawBins as { data?: StocktakeBin[] })?.data || []) as StocktakeBin[];

        if (!isMounted) return;
        setLocationBins(b);
      } catch (err) {
        reportError(err, 'StocktakeClient_LoadStocktake');
        toast.error(getErrorMessage(err));
      } finally {
        if (isMounted) setIsLoadingStocktake(false);
      }
    }

    loadStocktake();
    return () => {
      isMounted = false;
    };
  }, [stocktakeId]);

  // Matching Bins based on Zone & Bin Prefix Filter & sorted in natural walking order
  const matchingBins = useMemo(() => {
    let filtered = locationBins;
    if (selectedZone !== 'all') {
      filtered = filtered.filter(
        (b) => b.zoneCode?.toUpperCase() === selectedZone.toUpperCase(),
      );
    }
    if (binPattern.trim()) {
      filtered = filtered.filter((b) =>
        matchBinPattern(b, binPattern, stocktakeEntity?.locationCode),
      );
    }
    return [...filtered].sort((a, b) => compareBinNumbers(a.binNumber, b.binNumber));
  }, [locationBins, selectedZone, binPattern, stocktakeEntity?.locationCode]);

  // Auto-select first bin when matching bins load if not yet selected
  useEffect(() => {
    if (matchingBins.length > 0) {
      if (!selectedBinId || !matchingBins.some((b) => b.binId === selectedBinId)) {
        setSelectedBinId(matchingBins[0].binId);
        setSelectedBinNumber(matchingBins[0].binNumber);
      }
    }
  }, [matchingBins, selectedBinId]);

  // Active Bin Index in the walking sequence
  const activeBinIndex = useMemo(() => {
    const idx = matchingBins.findIndex((b) => b.binId === selectedBinId);
    return idx >= 0 ? idx : 0;
  }, [matchingBins, selectedBinId]);

  const activeBinObject = useMemo(() => {
    return (
      matchingBins.find((b) => b.binId === selectedBinId) ||
      locationBins.find((b) => b.binId === selectedBinId) ||
      null
    );
  }, [matchingBins, locationBins, selectedBinId]);

  const activeLoadingBinRef = useRef<string>('');

  // 2. Load Lines for the Active Bin on Demand (Per-Bin Loading)
  const loadBinItems = useCallback(
    async (binId: string) => {
      if (!stocktakeId || !binId) return;

      activeLoadingBinRef.current = binId;
      setIsLoadingItems(true);
      try {
        const linesRes = await api.stocktakesControllerFindLines(stocktakeId, {
          binId,
          limit: 1000,
        });

        if (activeLoadingBinRef.current !== binId) {
          return;
        }

        const rawLines = linesRes.data as unknown;
        const linesList = (Array.isArray(rawLines)
          ? rawLines
          : (rawLines as { data?: api.StocktakeLineResponseDto[] })?.data || []) as api.StocktakeLineResponseDto[];

        const mapped: StocktakeItem[] = linesList.map((line) => ({
          id: line.stocktakeLineId,
          productId: line.productId,
          productNumber: line.productNumber || line.productId,
          productName: line.productName || line.productNumber || line.productId,
          barcode: line.barcode || null,
          alternateProductNumber: line.alternateProductNumber || null,
          imagePath: null,
          description: null,
          baseUom: line.baseUom || 'EA',
          binId: line.binId,
          binNumber: line.binNumber,
          zoneCode: line.zoneCode || undefined,
          locationId: stocktakeEntity?.locationId || '',
          locationCode: stocktakeEntity?.locationCode || '',
          expectedQuantity:
            line.expectedQuantity !== null && line.expectedQuantity !== undefined
              ? parseFloat(String(line.expectedQuantity))
              : 0,
          countedQuantity:
            line.countedQuantity !== null && line.countedQuantity !== undefined
              ? parseFloat(String(line.countedQuantity))
              : null,
          isUnlisted: line.isUnlisted || false,
          notes: line.notes || undefined,
          lastCountedAt: line.lastCountedAt ? new Date(line.lastCountedAt) : undefined,
        }));

        setItems(mapped);
      } catch (err) {
        if (activeLoadingBinRef.current === binId) {
          reportError(err, 'StocktakeClient_LoadBinItems');
          toast.error(getErrorMessage(err));
        }
      } finally {
        if (activeLoadingBinRef.current === binId) {
          setIsLoadingItems(false);
        }
      }
    },
    [stocktakeId, stocktakeEntity?.locationId, stocktakeEntity?.locationCode],
  );

  useEffect(() => {
    if (selectedBinId) {
      loadBinItems(selectedBinId);
    }
  }, [selectedBinId, loadBinItems]);

  // Refresh stocktake header metrics on demand
  const refreshStocktakeHeader = useCallback(async () => {
    if (!stocktakeId) return;
    try {
      const res = await api.stocktakesControllerFindOne(stocktakeId);
      setStocktakeEntity(res.data);
    } catch {
      // ignore background refresh errors
    }
  }, [stocktakeId]);

  // Sound / Haptic trigger helpers
  const triggerAffirmative = useCallback(() => {
    if (isSoundEnabled) playSuccess();
    if (isVibrateEnabled) vibrateSuccess();
  }, [isSoundEnabled, isVibrateEnabled, playSuccess, vibrateSuccess]);

  const triggerError = useCallback(() => {
    if (isSoundEnabled) playError();
    if (isVibrateEnabled) vibrateError();
  }, [isSoundEnabled, isVibrateEnabled, playError, vibrateError]);

  const triggerBinSwitch = useCallback(() => {
    if (isSoundEnabled) playBinSwitch();
    if (isVibrateEnabled) vibrateBinSwitch();
  }, [isSoundEnabled, isVibrateEnabled, playBinSwitch, vibrateBinSwitch]);

  // Navigation Steppers
  const handlePreviousBin = useCallback(() => {
    if (activeBinIndex > 0) {
      const prevBin = matchingBins[activeBinIndex - 1];
      setSelectedBinId(prevBin.binId);
      setSelectedBinNumber(prevBin.binNumber);
      triggerBinSwitch();
    }
  }, [activeBinIndex, matchingBins, triggerBinSwitch]);

  const handleNextBin = useCallback(() => {
    if (activeBinIndex < matchingBins.length - 1) {
      const nextBin = matchingBins[activeBinIndex + 1];
      setSelectedBinId(nextBin.binId);
      setSelectedBinNumber(nextBin.binNumber);
      triggerBinSwitch();
    }
  }, [activeBinIndex, matchingBins, triggerBinSwitch]);

  const handleSelectBin = useCallback(
    (binId: string) => {
      const matched = locationBins.find((b) => b.binId === binId);
      if (matched) {
        setSelectedBinId(matched.binId);
        setSelectedBinNumber(matched.binNumber);
        triggerBinSwitch();
      }
    },
    [locationBins, triggerBinSwitch],
  );

  // Action: Confirm current bin as Empty and advance to next bin if available
  const handleConfirmEmptyBin = useCallback(() => {
    const targetBinId = selectedBinId || activeBinObject?.binId;
    if (!targetBinId) return;

    setConfirmedEmptyBinIds((prev) =>
      prev.includes(targetBinId) ? prev : [...prev, targetBinId],
    );

    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        countedQuantity: 0,
        lastCountedAt: new Date(),
      })),
    );

    if (items.length > 0) {
      api
        .stocktakesControllerRecordBatchCounts(stocktakeId, {
          counts: items.map((i) => ({
            productId: i.productId,
            binId: i.binId,
            quantity: '0',
          })),
        })
        .then(() => refreshStocktakeHeader())
        .catch((err: unknown) => {
          reportError(err, 'StocktakeClient_BatchEmpty');
          toast.error(getErrorMessage(err));
        });
    }

    triggerAffirmative();
    toast.success(t('feedback.binConfirmedEmpty', { bin: selectedBinNumber }));

    if (activeBinIndex < matchingBins.length - 1) {
      const nextBin = matchingBins[activeBinIndex + 1];
      setSelectedBinId(nextBin.binId);
      setSelectedBinNumber(nextBin.binNumber);
      triggerBinSwitch();
    }
  }, [
    selectedBinId,
    activeBinObject,
    items,
    stocktakeId,
    selectedBinNumber,
    activeBinIndex,
    matchingBins,
    triggerAffirmative,
    triggerBinSwitch,
    refreshStocktakeHeader,
    t,
  ]);

  // Action: Mark current bin as Done (zeroes uncounted items in active bin and advances to next bin if available)
  const handleMarkBinDone = useCallback(() => {
    const targetBinId = selectedBinId || activeBinObject?.binId;
    if (!targetBinId) return;

    const uncountedInBin = items.filter((item) => item.countedQuantity === null);

    setItems((prev) =>
      prev.map((item) => {
        if (item.countedQuantity === null) {
          return {
            ...item,
            countedQuantity: 0,
            lastCountedAt: new Date(),
          };
        }
        return item;
      }),
    );

    if (uncountedInBin.length > 0) {
      api
        .stocktakesControllerRecordBatchCounts(stocktakeId, {
          counts: uncountedInBin.map((i) => ({
            productId: i.productId,
            binId: i.binId,
            quantity: '0',
          })),
        })
        .then(() => refreshStocktakeHeader())
        .catch((err: unknown) => {
          reportError(err, 'StocktakeClient_BatchDone');
          toast.error(getErrorMessage(err));
        });
    }

    triggerAffirmative();

    if (activeBinIndex < matchingBins.length - 1) {
      const nextBin = matchingBins[activeBinIndex + 1];
      setSelectedBinId(nextBin.binId);
      setSelectedBinNumber(nextBin.binNumber);
      triggerBinSwitch();
    }
  }, [
    selectedBinId,
    activeBinObject,
    items,
    stocktakeId,
    activeBinIndex,
    matchingBins,
    triggerAffirmative,
    triggerBinSwitch,
    refreshStocktakeHeader,
  ]);

  // Update item count handler
  const handleUpdateCount = useCallback(
    (itemId: string, newCount: number | null) => {
      const targetItem = items.find((i) => i.id === itemId);
      setItems((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? { ...item, countedQuantity: newCount, lastCountedAt: new Date() }
            : item,
        ),
      );

      if (targetItem) {
        api
          .stocktakesControllerRecordCount(stocktakeId, {
            productId: targetItem.productId,
            binId: targetItem.binId,
            quantity: String(newCount ?? 0),
            notes: targetItem.notes,
          })
          .then(() => refreshStocktakeHeader())
          .catch((err) => {
            reportError(err, 'StocktakeClient_RecordCount');
            toast.error(getErrorMessage(err));
          });
      }
    },
    [items, stocktakeId, refreshStocktakeHeader],
  );

  // Increment item count handler
  const handleIncrement = useCallback(
    (itemId: string, delta: number) => {
      const targetItem = items.find((i) => i.id === itemId);
      const current = targetItem?.countedQuantity ?? 0;
      const updated = Math.max(0, current + delta);

      setItems((prev) =>
        prev.map((item) => {
          if (item.id === itemId) {
            return {
              ...item,
              countedQuantity: updated,
              lastCountedAt: new Date(),
            };
          }
          return item;
        }),
      );

      if (targetItem) {
        api
          .stocktakesControllerRecordCount(stocktakeId, {
            productId: targetItem.productId,
            binId: targetItem.binId,
            quantity: String(updated),
            notes: targetItem.notes,
          })
          .then(() => refreshStocktakeHeader())
          .catch((err) => {
            reportError(err, 'StocktakeClient_RecordCount');
            toast.error(getErrorMessage(err));
          });
      }
    },
    [items, stocktakeId, refreshStocktakeHeader],
  );

  // Update item notes handler
  const handleUpdateNotes = useCallback(
    (itemId: string, notes: string) => {
      const targetItem = items.find((i) => i.id === itemId);
      setItems((prev) =>
        prev.map((item) => (item.id === itemId ? { ...item, notes } : item)),
      );

      if (targetItem) {
        api
          .stocktakesControllerUpdateLine(stocktakeId, targetItem.id, { notes })
          .catch((err) => {
            reportError(err, 'StocktakeClient_UpdateNotes');
            toast.error(getErrorMessage(err));
          });
      }
    },
    [items, stocktakeId],
  );

  const hasUncountedInActiveBin = useMemo(() => {
    if (!selectedBinId) return false;
    return items.some(
      (i) => i.binId === selectedBinId && i.countedQuantity === null,
    );
  }, [selectedBinId, items]);

  const handleMarkBinEmpty = useCallback(async () => {
    if (!selectedBinId) return;
    const binName = selectedBinNumber || 'active bin';
    const uncountedInBin = items.filter(
      (i) => i.binId === selectedBinId && i.countedQuantity === null,
    );
    const countToZero =
      uncountedInBin.length > 0 ? uncountedInBin.length : items.length;

    if (
      !window.confirm(
        t('markBinEmptyConfirm', { bin: binName, count: countToZero }),
      )
    ) {
      return;
    }

    try {
      await api.stocktakesControllerMarkBinEmpty(stocktakeId, selectedBinId, {});
      setConfirmedEmptyBinIds((prev) =>
        prev.includes(selectedBinId) ? prev : [...prev, selectedBinId],
      );
      setItems((prev) =>
        prev.map((item) => {
          if (item.binId === selectedBinId) {
            return {
              ...item,
              countedQuantity: 0,
              lastCountedAt: new Date(),
            };
          }
          return item;
        }),
      );
      toast.success(t('markBinEmptySuccess', { bin: binName }));
      triggerAffirmative();
      refreshStocktakeHeader();
      handleNextBin();
    } catch (err) {
      reportError(err, 'StocktakeClient_MarkBinEmpty');
      toast.error(getErrorMessage(err) || 'Failed to mark bin empty');
    }
  }, [
    selectedBinId,
    selectedBinNumber,
    items,
    stocktakeId,
    t,
    triggerAffirmative,
    refreshStocktakeHeader,
    handleNextBin,
  ]);

  // Main Barcode Processing Core (Hardware Scanner + Camera)
  const handleBarcodeScanned = useCallback(
    async (rawCode: string) => {
      const code = rawCode.trim();
      if (!code || isProcessingBarcode) return;

      setIsProcessingBarcode(true);

      try {
        // 1. Check if scanned code is a Bin Barcode in this warehouse
        const matchedBin = locationBins.find(
          (b) => b.binNumber.toUpperCase() === code.toUpperCase(),
        );

        if (matchedBin) {
          setSelectedBinId(matchedBin.binId);
          setSelectedBinNumber(matchedBin.binNumber);
          triggerBinSwitch();
          setFeedback({
            type: 'info',
            message: t('feedback.binSwitched', { bin: matchedBin.binNumber }),
            detail: t('feedback.binSwitchedDetail'),
          });
          return;
        }

        // 2. Check if scanned code matches an item in the active bin
        const normalizedCode = code.toUpperCase();
        const activeItemIdx = items.findIndex(
          (item) =>
            item.barcode?.toUpperCase() === normalizedCode ||
            item.productNumber.toUpperCase() === normalizedCode ||
            item.alternateProductNumber?.toUpperCase() === normalizedCode,
        );

        if (activeItemIdx !== -1) {
          const item = items[activeItemIdx];
          const newCount = (item.countedQuantity ?? 0) + 1;
          setSelectedItemId(item.id);

          setItems((prev) => {
            const updated = [...prev];
            updated[activeItemIdx] = {
              ...item,
              countedQuantity: newCount,
              lastCountedAt: new Date(),
            };
            return updated;
          });

          api
            .stocktakesControllerRecordCount(stocktakeId, {
              productId: item.productId,
              binId: item.binId,
              quantity: String(newCount),
              notes: item.notes,
            })
            .then(() => refreshStocktakeHeader())
            .catch((err) => {
              reportError(err, 'StocktakeClient_RecordCount');
              toast.error(getErrorMessage(err));
            });

          triggerAffirmative();
          setFeedback({
            type: 'success',
            message: t('feedback.itemCounted', {
              sku: item.productNumber,
              count: newCount,
              uom: item.baseUom,
            }),
            detail: `${item.productName} (${item.binNumber})`,
          });
          return;
        }

        // 3. Not in active bin — search product catalog API for unlisted product
        const targetBinId = selectedBinId || matchingBins[0]?.binId || '';
        const targetBinNumber = selectedBinNumber || matchingBins[0]?.binNumber || '';

        const searchRes = await api.productsControllerFindAll({
          q: code,
          limit: 10,
        });

        const rawSearchData = searchRes.data as unknown;
        const prods = (Array.isArray(rawSearchData)
          ? rawSearchData
          : (rawSearchData as { data?: RawProductSearchResult[] })?.data || []) as RawProductSearchResult[];
        const inventoryProds = prods.filter((p) => !p.productType || p.productType === 'inventory');

        if (inventoryProds.length > 0) {
          const prod = inventoryProds[0];
          let createdLineId = `${targetBinId}_${prod.productId}`;

          try {
            const addRes = await api.stocktakesControllerAddUnlistedProduct(stocktakeId, {
              productId: prod.productId,
              binId: targetBinId,
              countedQuantity: '1',
            });
            if (addRes.data?.stocktakeLineId) {
              createdLineId = addRes.data.stocktakeLineId;
            }
            refreshStocktakeHeader();
          } catch (err) {
            reportError(err, 'StocktakeClient_AddUnlisted');
            toast.error(getErrorMessage(err));
          }

          const newItem: StocktakeItem = {
            id: createdLineId,
            productId: prod.productId,
            productNumber: prod.productNumber,
            productName: prod.name || prod.productNumber,
            barcode: prod.barcode || code,
            alternateProductNumber: prod.alternateProductNumber || null,
            imagePath: prod.imagePath || null,
            description: prod.description || null,
            baseUom: prod.baseUom || 'EA',
            binId: targetBinId,
            binNumber: targetBinNumber,
            locationId: stocktakeEntity?.locationId || '',
            locationCode: stocktakeEntity?.locationCode || '',
            expectedQuantity: 0,
            countedQuantity: 1,
            isUnlisted: true,
            lastCountedAt: new Date(),
          };

          setItems((prev) => [newItem, ...prev]);
          setSelectedItemId(newItem.id);
          triggerAffirmative();
          setFeedback({
            type: 'success',
            message: t('feedback.unlistedAdded', {
              sku: prod.productNumber,
              bin: targetBinNumber,
            }),
            detail: prod.name || prod.productNumber,
          });
          return;
        }

        // 4. Barcode not found
        triggerError();
        setFeedback({
          type: 'error',
          message: t('feedback.barcodeNotFound', { code }),
          detail: t('feedback.barcodeNotFoundDetail'),
        });
      } catch (err) {
        reportError(err, 'StocktakeClient_Scan');
        triggerError();
        setFeedback({
          type: 'error',
          message: t('feedback.scanError'),
          detail: getErrorMessage(err),
        });
      } finally {
        setIsProcessingBarcode(false);
      }
    },
    [
      isProcessingBarcode,
      locationBins,
      items,
      selectedBinId,
      selectedBinNumber,
      matchingBins,
      stocktakeId,
      stocktakeEntity?.locationId,
      stocktakeEntity?.locationCode,
      triggerBinSwitch,
      triggerAffirmative,
      triggerError,
      refreshStocktakeHeader,
      t,
    ],
  );

  // Global Barcode Listener for Physical USB / Bluetooth Scanners
  const bufferRef = useRef('');
  const lastKeyTimeRef = useRef(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isInput =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLSelectElement;

      // Allow Enter submission from specific search inputs
      if (isInput && (activeElement as HTMLElement)?.dataset?.barcodeInput) {
        if (e.key === 'Enter') {
          e.preventDefault();
          const target = activeElement as HTMLInputElement;
          const val = target.value.trim();
          if (val) {
            handleBarcodeScanned(val);
            target.value = '';
          }
        }
        return;
      }

      if (isInput) return;

      const now = Date.now();
      const elapsed = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      if (elapsed > 100) {
        bufferRef.current = '';
      }

      if (e.key === 'Enter') {
        if (bufferRef.current.length >= 2) {
          e.preventDefault();
          const scanned = bufferRef.current;
          bufferRef.current = '';
          handleBarcodeScanned(scanned);
        }
        return;
      }

      if (e.key.length === 1) {
        bufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleBarcodeScanned]);

  // Add Unlisted Product Confirmation
  const handleAddUnlistedConfirm = async (
    prod: ProductSearchResult,
    countedQty: number,
  ) => {
    const targetBinId = selectedBinId || matchingBins[0]?.binId || '';
    const targetBinNumber = selectedBinNumber || matchingBins[0]?.binNumber || '';

    let createdLineId = `${targetBinId}_${prod.productId}`;
    try {
      const addRes = await api.stocktakesControllerAddUnlistedProduct(stocktakeId, {
        productId: prod.productId,
        binId: targetBinId,
        countedQuantity: String(countedQty),
      });
      if (addRes.data?.stocktakeLineId) {
        createdLineId = addRes.data.stocktakeLineId;
      }
      refreshStocktakeHeader();
    } catch (err) {
      reportError(err, 'StocktakeClient_AddUnlisted');
      toast.error(getErrorMessage(err));
    }

    const newItem: StocktakeItem = {
      id: createdLineId,
      productId: prod.productId,
      productNumber: prod.productNumber,
      productName: prod.name,
      barcode: prod.barcode || null,
      imagePath: prod.imagePath || null,
      description: prod.description || null,
      baseUom: prod.baseUom || 'EA',
      binId: targetBinId,
      binNumber: targetBinNumber,
      locationId: stocktakeEntity?.locationId || '',
      locationCode: stocktakeEntity?.locationCode || '',
      expectedQuantity: 0,
      countedQuantity: countedQty,
      isUnlisted: true,
      lastCountedAt: new Date(),
    };

    setItems((prev) => [newItem, ...prev]);
    setSelectedItemId(newItem.id);
    triggerAffirmative();
    toast.success(t('addUnlisted.addedSuccess', { sku: prod.productNumber }));
  };

  // Reconciliation Submission
  const handleSubmitStocktake = async (reason: string) => {
    try {
      await api.stocktakesControllerSubmit(stocktakeId, {
        reason,
      });

      setIsCompleted(true);
      setCompletedSummary({
        adjustedCount: stocktakeEntity?.totalLines || items.length,
        reason,
      });
      triggerAffirmative();
      toast.success(t('review.commitSuccess'));
    } catch (err) {
      reportError(err, 'StocktakeClient_Submit');
      triggerError();
      toast.error(getErrorMessage(err));
      throw err;
    }
  };

  // Reopen Stocktake for Counting from Review State
  const [isReopening, setIsReopening] = useState(false);
  const handleReopenForCounting = useCallback(async () => {
    if (!stocktakeId) return;
    setIsReopening(true);
    try {
      await api.stocktakesControllerChangeState(stocktakeId, {
        stateCode: STOCKTAKE_STATE.OPEN,
      });
      await refreshStocktakeHeader();
      triggerAffirmative();
      toast.success(t('reopenSuccess'));
    } catch (err) {
      reportError(err, 'StocktakeClient_Reopen');
      toast.error(getErrorMessage(err) || 'Failed to reopen stocktake');
    } finally {
      setIsReopening(false);
    }
  }, [stocktakeId, refreshStocktakeHeader, triggerAffirmative, t]);

  // Filtered and Searched Items in Active Bin
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (searchFilter.trim()) {
        const q = searchFilter.trim().toLowerCase();
        const matchesSku = item.productNumber.toLowerCase().includes(q);
        const matchesName = item.productName.toLowerCase().includes(q);
        const matchesBarcode = item.barcode?.toLowerCase().includes(q);
        if (!matchesSku && !matchesName && !matchesBarcode) {
          return false;
        }
      }

      if (activeFilter === 'all') return true;
      if (activeFilter === 'counted') return item.countedQuantity !== null;
      if (activeFilter === 'uncounted') return item.countedQuantity === null;
      if (activeFilter === 'discrepancies') {
        if (item.countedQuantity === null) return false;
        const st = getCountStatus(item);
        return st === 'surplus' || st === 'shortage';
      }
      return true;
    });
  }, [items, searchFilter, activeFilter]);

  // Counts for the active bin filter tabs
  const binFilterCounts = useMemo(() => {
    const total = items.length;
    let counted = 0;
    let discrepancies = 0;

    items.forEach((item) => {
      const st = getCountStatus(item);
      if (st !== 'uncounted') counted++;
      if (st === 'surplus' || st === 'shortage') discrepancies++;
    });

    return {
      all: total,
      counted,
      uncounted: total - counted,
      discrepancies,
    };
  }, [items]);

  // Auto-select top item when items load
  useEffect(() => {
    if (filteredItems.length > 0) {
      if (!selectedItemId || !filteredItems.some((i) => i.id === selectedItemId)) {
        setSelectedItemId(filteredItems[0].id);
      }
    } else {
      setSelectedItemId(null);
    }
  }, [filteredItems, selectedItemId]);

  // Selected item object for sticky footer actions
  const selectedItem = useMemo(() => {
    if (!selectedItemId) return null;
    return items.find((i) => i.id === selectedItemId) || null;
  }, [items, selectedItemId]);

  // Blind Count Mode Toggle with Backend Sync
  const handleToggleBlindCount = useCallback(async () => {
    const nextVal = !isBlindCount;
    setIsBlindCount(nextVal);
    if (!stocktakeId) return;
    try {
      await api.stocktakesControllerUpdate(stocktakeId, { isBlindCount: nextVal });
      await refreshStocktakeHeader();
      if (selectedBinId) {
        await loadBinItems(selectedBinId);
      }
    } catch (err) {
      reportError(err, 'StocktakeClient_ToggleBlindCount');
      toast.error(getErrorMessage(err));
    }
  }, [isBlindCount, stocktakeId, selectedBinId, refreshStocktakeHeader, loadBinItems]);

  // Render Completion Screen
  if (isCompleted && completedSummary) {
    const locationDisplay = stocktakeEntity
      ? `${stocktakeEntity.locationName} (${stocktakeEntity.locationCode})`
      : '';

    return (
      <div className="flex flex-col flex-1 p-6 max-w-3xl mx-auto w-full justify-center items-center text-center select-none">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-500 mb-4">
          <span className="material-symbols-outlined text-4xl">task_alt</span>
        </div>

        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">
          {t('completed.title')}
        </h1>

        <div className="card p-4 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl w-full max-w-md mb-6 text-left text-xs font-mono">
          <div className="flex justify-between py-1.5 border-b border-[var(--border)]">
            <span className="text-[var(--text-muted)] font-sans">{t('completed.location')}:</span>
            <span className="font-bold text-[var(--text-primary)]">{locationDisplay}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-[var(--border)]">
            <span className="text-[var(--text-muted)] font-sans">{t('completed.memo')}:</span>
            <span className="text-[var(--text-primary)] truncate max-w-[200px]">
              {completedSummary.reason}
            </span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-[var(--text-muted)] font-sans">{t('completed.linesReconciled')}:</span>
            <span className="font-bold text-emerald-500">{completedSummary.adjustedCount}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href={routes.inventory.stocktakes.list()} className="no-underline">
            <Button variant="secondary">
              {t('backToStocktakes')}
            </Button>
          </Link>
          <Link href={routes.inventory.ledger()} className="no-underline">
            <Button variant="primary" className="font-bold">
              {t('completed.viewInventoryLedger')}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 h-full p-4 lg:p-6 overflow-y-auto max-w-7xl mx-auto w-full gap-4">
      {/* Page Header */}
      <ContentPageHeader
        title={
          stocktakeEntity?.stocktakeNumber
            ? tDetail('title', { number: stocktakeEntity.stocktakeNumber })
            : t('title')
        }
        className="!mb-0"
      >
        <div className="flex items-center gap-2 ml-auto">
          {/* Blind Count Mode Toggle (Icon Only) */}
          <Button
            type="button"
            variant="secondary"
            size="icon"
            icon={isBlindCount ? 'visibility_off' : 'visibility'}
            onClick={handleToggleBlindCount}
            title={isBlindCount ? t('disableBlindCount') : t('enableBlindCount')}
            aria-label={t('blindCount')}
            aria-pressed={isBlindCount}
          />

          {/* Audio Toggle (Icon Only) */}
          <Button
            type="button"
            variant="secondary"
            size="icon"
            icon={isSoundEnabled ? 'volume_up' : 'volume_off'}
            onClick={() => setIsSoundEnabled(!isSoundEnabled)}
            title={isSoundEnabled ? t('muteSound') : t('unmuteSound')}
            aria-label={isSoundEnabled ? t('muteSound') : t('unmuteSound')}
            aria-pressed={isSoundEnabled}
          />

          {/* If in Review state, provide Reopen button */}
          {stocktakeEntity?.stateCode === STOCKTAKE_STATE.REVIEW && canWrite && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={isReopening}
              onClick={handleReopenForCounting}
              className="font-semibold shrink-0"
            >
              {t('reopen')}
            </Button>
          )}

          {/* Review Button (Top Right) */}
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={async () => {
              try {
                if (stocktakeEntity?.stateCode !== STOCKTAKE_STATE.REVIEW) {
                  await api.stocktakesControllerChangeState(stocktakeId, { stateCode: STOCKTAKE_STATE.REVIEW });
                  await refreshStocktakeHeader();
                }
                setIsReviewModalOpen(true);
              } catch (err) {
                toast.error(getErrorMessage(err) || 'Failed to transition to review');
              }
            }}
            disabled={stocktakeEntity?.countedLines === 0 && items.filter((i) => i.countedQuantity !== null).length === 0}
            title={!canWrite ? t('readOnlyNotice') : undefined}
            className="font-bold shrink-0"
          >
            {t('reviewButton')}
          </Button>
        </div>
      </ContentPageHeader>

      {/* Scope Info Card */}
      {stocktakeEntity && (
        <div className="card bg-[var(--bg-secondary)]/40 border border-[var(--border)] p-4 text-sm flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-semibold text-[var(--text-primary)]">
              {stocktakeEntity.name}
            </span>
            <span className="text-[var(--text-muted)]">•</span>
            <span className="text-[var(--text-secondary)]">
              {stocktakeEntity.locationName} ({stocktakeEntity.locationCode})
            </span>
            {stocktakeEntity.scopeType === 'bin_pattern' && stocktakeEntity.binPattern && (
              <>
                <span className="text-[var(--text-muted)]">•</span>
                <span className="font-mono badge badge-secondary text-xs">
                  {stocktakeEntity.binPattern}
                </span>
              </>
            )}
            {stocktakeEntity.scopeType === 'zone' && stocktakeEntity.zoneFilter && (
              <>
                <span className="text-[var(--text-muted)]">•</span>
                <span className="font-mono badge badge-secondary text-xs">
                  {stocktakeEntity.zoneFilter}
                </span>
              </>
            )}

            {/* Discrepancies Summary Badge */}
            {isBlindCount ? (
              <span className="badge badge-secondary text-xs font-medium">
                {t('blindCountDiscrepancyMasked')}
              </span>
            ) : (stocktakeEntity.discrepancyLines ?? 0) > 0 ? (
              <span className="badge badge-warning text-xs font-medium">
                {t('summary.discrepancies', { count: stocktakeEntity.discrepancyLines ?? 0 })}
              </span>
            ) : (stocktakeEntity.countedLines ?? 0) > 0 ? (
              <span className="badge badge-success text-xs font-medium">
                {t('summary.allMatched')}
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsBinOverviewOpen(true)}
              className="text-xs font-medium"
            >
              {t('binOverview')} ({matchingBins.length})
            </Button>
          </div>
        </div>
      )}

      {/* Barcode Scanner Input Card */}
      <BarcodeScannerCard
        onScan={handleBarcodeScanned}
        placeholder={t('scanInputPlaceholder')}
        feedback={feedback}
        isProcessing={isProcessingBarcode}
      />

      {/* Bin Walking Navigator Card */}
      <BinNavigatorCard
        activeBin={activeBinObject}
        currentIndex={activeBinIndex}
        totalBins={matchingBins.length}
        onPreviousBin={handlePreviousBin}
        onNextBin={handleNextBin}
      />

      {/* Items in Current Bin Section */}
      <div className="card flex flex-col gap-4">
        {/* Toolbar Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border)]">
          <div>
            <h3 className="text-base font-bold text-[var(--text-primary)]">
              {t('itemsInBin', { bin: selectedBinNumber || t('allBinsOption') })}
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              {items.length} {t('summary.items').toLowerCase()}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="icon"
              icon="qr_code_scanner"
              onClick={() => setIsCameraScannerOpen(true)}
              title={t('openCamera')}
              aria-label={t('openCamera')}
            />

            <Button
              type="button"
              variant="secondary"
              size="icon"
              icon="add"
              onClick={() => setIsAddUnlistedOpen(true)}
              title={t('unlistedItem')}
              aria-label={t('unlistedItem')}
            />

            <Button
              type="button"
              variant="secondary"
              size="icon"
              icon="layers_clear"
              onClick={handleConfirmEmptyBin}
              title={t('confirmEmpty')}
              aria-label={t('confirmEmpty')}
            />

            <Button
              type="button"
              variant="secondary"
              size="icon"
              icon="check"
              onClick={handleMarkBinDone}
              disabled={items.length === 0}
              title={t('done')}
              aria-label={t('done')}
            />
          </div>
        </div>

        {/* Filter Tabs & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1 border border-[var(--border)] rounded-lg p-0.5 bg-[var(--bg-secondary)]/50">
            {(['all', 'uncounted', 'counted', 'discrepancies'] as StocktakeFilter[]).map((f) => (
              <Button
                key={f}
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => setActiveFilter(f)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                  activeFilter === f
                    ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-xs'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                {t(`filters.${f}`)} ({binFilterCounts[f]})
              </Button>
            ))}
          </div>

          <div className="relative flex-1 max-w-xs">
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder={t('filterSearchPlaceholder')}
              className="input input-sm w-full text-xs"
            />
            {searchFilter && (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                icon="close"
                onClick={() => setSearchFilter('')}
                aria-label={tCommon('clear')}
                className="absolute right-1 top-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] h-6 w-6 p-0"
              />
            )}
          </div>
        </div>

        {/* Items List */}
        {isLoadingItems ? (
          <div className="p-8 text-center text-xs text-[var(--text-muted)] animate-pulse">
            {t('processing')}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-8 text-center text-xs text-[var(--text-muted)]">
            {items.length === 0 ? t('emptyBinDesc') : t('noItemsSearchMatch')}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filteredItems.map((item) => (
              <StocktakeLineItem
                key={item.id}
                item={item}
                isSelected={selectedItemId === item.id}
                isBlindCount={isBlindCount}
                onSelect={(id) => setSelectedItemId(id)}
                onUpdateCount={handleUpdateCount}
                onIncrement={handleIncrement}
                onUpdateNotes={handleUpdateNotes}
              />
            ))}
          </div>
        )}
      </div>



      {/* Sticky Action Footer */}
      <StocktakeStickyFooter
        selectedItem={selectedItem}
        isBlindCount={isBlindCount}
        onUpdateCount={handleUpdateCount}
        onIncrement={handleIncrement}
        onUpdateNotes={handleUpdateNotes}
      />

      {/* Bin Overview Drawer */}
      <BinOverviewDrawer
        isOpen={isBinOverviewOpen}
        onClose={() => setIsBinOverviewOpen(false)}
        bins={matchingBins}
        items={items}
        stocktakeId={stocktakeId}
        confirmedEmptyBinIds={confirmedEmptyBinIds}
        activeBinId={selectedBinId}
        onSelectBin={handleSelectBin}
      />

      {/* Camera Barcode Scanner Modal */}
      <CameraBarcodeScannerModal
        isOpen={isCameraScannerOpen}
        onClose={() => setIsCameraScannerOpen(false)}
        onScan={handleBarcodeScanned}
        title={t('cameraModalTitle')}
        subtitle={t('cameraModalSubtitle', { bin: selectedBinNumber })}
      />

      {/* Review & Reconcile Modal */}
      <StocktakeReviewModal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        stocktakeId={stocktakeId}
        locationCode={stocktakeEntity?.locationCode || ''}
        canWrite={canWrite}
        onSubmitReconciliation={handleSubmitStocktake}
        onReopen={handleReopenForCounting}
      />

      {/* Add Unlisted Item Modal */}
      <AddUnlistedProductModal
        isOpen={isAddUnlistedOpen}
        onClose={() => setIsAddUnlistedOpen(false)}
        activeBin={activeBinObject}
        onAddProduct={handleAddUnlistedConfirm}
      />
    </div>
  );
}
