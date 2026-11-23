import { create } from 'zustand';
import type { AppErrorCode } from '../../application/errors';
import type { PickedFile } from '../../application/ports';
import type { ZoomMode } from '../../application/viewer';
import { clampZoom, DEFAULT_ZOOM } from '../../application/viewer';
import type { DocumentInfo, SearchResult } from '../../domain/document';

export type EngineStatus = 'loading' | 'ready' | 'error';
export type SidebarTab = 'thumbnails' | 'search';

export interface OpenedDocument {
  readonly info: DocumentInfo;
  readonly fileName: string;
}

export interface PendingPassword {
  readonly file: PickedFile;
  readonly wrongPassword: boolean;
}

/** A request for the document view to scroll; `sequence` makes repeated requests distinct. */
export interface ScrollRequest {
  readonly pageIndex: number;
  readonly sequence: number;
  /** Optional area (display space of that page) to bring into view, e.g. a search hit. */
  readonly focusTop?: number;
}

export interface SearchState {
  readonly query: string;
  readonly running: boolean;
  readonly result: SearchResult | null;
  readonly activeHit: number | null;
}

interface ViewerState {
  readonly engineStatus: EngineStatus;
  readonly engineProgress: number;
  readonly document: OpenedDocument | null;
  readonly opening: boolean;
  readonly pendingPassword: PendingPassword | null;
  readonly error: AppErrorCode | null;
  readonly zoom: number;
  readonly zoomMode: ZoomMode;
  readonly currentPage: number;
  readonly scrollRequest: ScrollRequest | null;
  readonly sidebarOpen: boolean;
  readonly sidebarTab: SidebarTab;
  readonly search: SearchState;
  readonly searchFocusSequence: number;
  readonly pendingLink: string | null;
  readonly dialog: 'shortcuts' | 'about' | null;
}

interface ViewerActions {
  setEngineProgress: (progress: number) => void;
  setEngineStatus: (status: EngineStatus) => void;
  setOpening: (opening: boolean) => void;
  setDocument: (document: OpenedDocument | null) => void;
  setPendingPassword: (pending: PendingPassword | null) => void;
  showError: (code: AppErrorCode | null) => void;
  setZoom: (zoom: number, mode?: ZoomMode) => void;
  setZoomMode: (mode: ZoomMode) => void;
  setCurrentPage: (pageIndex: number) => void;
  goToPage: (pageIndex: number, focusTop?: number) => void;
  toggleSidebar: () => void;
  openSidebar: (tab: SidebarTab) => void;
  focusSearch: () => void;
  setSearch: (search: Partial<SearchState>) => void;
  confirmLink: (uri: string | null) => void;
  openDialog: (dialog: ViewerState['dialog']) => void;
}

const EMPTY_SEARCH: SearchState = { query: '', running: false, result: null, activeHit: null };

export const useViewerStore = create<ViewerState & ViewerActions>()((set, get) => ({
  engineStatus: 'loading',
  engineProgress: 0,
  document: null,
  opening: false,
  pendingPassword: null,
  error: null,
  zoom: DEFAULT_ZOOM,
  zoomMode: 'fit-width',
  currentPage: 0,
  scrollRequest: null,
  sidebarOpen: true,
  sidebarTab: 'thumbnails',
  search: EMPTY_SEARCH,
  searchFocusSequence: 0,
  pendingLink: null,
  dialog: null,

  setEngineProgress: (engineProgress) => {
    set({ engineProgress });
  },
  setEngineStatus: (engineStatus) => {
    set({ engineStatus });
  },
  setOpening: (opening) => {
    set({ opening });
  },
  setDocument: (document) => {
    set({
      document,
      currentPage: 0,
      scrollRequest: null,
      search: EMPTY_SEARCH,
      zoomMode: 'fit-width',
      pendingPassword: null,
    });
  },
  setPendingPassword: (pendingPassword) => {
    set({ pendingPassword });
  },
  showError: (error) => {
    set({ error });
  },
  setZoom: (zoom, mode = 'custom') => {
    set({ zoom: clampZoom(zoom), zoomMode: mode });
  },
  setZoomMode: (zoomMode) => {
    set({ zoomMode });
  },
  setCurrentPage: (currentPage) => {
    if (get().currentPage !== currentPage) {
      set({ currentPage });
    }
  },
  goToPage: (pageIndex, focusTop) => {
    const sequence = (get().scrollRequest?.sequence ?? 0) + 1;
    set({
      currentPage: pageIndex,
      scrollRequest:
        focusTop === undefined ? { pageIndex, sequence } : { pageIndex, sequence, focusTop },
    });
  },
  toggleSidebar: () => {
    set({ sidebarOpen: !get().sidebarOpen });
  },
  openSidebar: (sidebarTab) => {
    set({ sidebarOpen: true, sidebarTab });
  },
  focusSearch: () => {
    set({
      sidebarOpen: true,
      sidebarTab: 'search',
      searchFocusSequence: get().searchFocusSequence + 1,
    });
  },
  setSearch: (search) => {
    set({ search: { ...get().search, ...search } });
  },
  confirmLink: (pendingLink) => {
    set({ pendingLink });
  },
  openDialog: (dialog) => {
    set({ dialog });
  },
}));
