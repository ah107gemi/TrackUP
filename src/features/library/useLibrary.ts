import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchUserLibrary,
  upsertLibraryItem,
  updateItemStatus,
  logEpisodeProgress,
  logBatchEpisodeProgress,
  logReadingProgress,
  removeLibraryItem,
  calculateTotalEpisodes,
  calculateWatchedEpisodesCount,
  inferWatchedTrackingStatus,
  type UserLibraryItem,
} from './libraryService';
import type { TrackingStatus } from '../../types/database.types';

export function useUserLibrary(userId: string | undefined) {
  return useQuery({
    queryKey: ['library', userId],
    queryFn: () => (userId ? fetchUserLibrary(userId) : Promise.resolve([])),
    enabled: !!userId,
  });
}

export function useUpsertLibrary() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      userId: string;
      titleId: string;
      status?: TrackingStatus;
      rating?: number | null;
      isPrivate?: boolean;
      notes?: string | null;
      titleData?: import('../../lib/validators').NormalizedCatalogItem;
    }) => upsertLibraryItem(params),
    onMutate: async (newEntry) => {
      await queryClient.cancelQueries({ queryKey: ['library', newEntry.userId] });
      const previous = queryClient.getQueryData<UserLibraryItem[]>(['library', newEntry.userId]);

      if (previous) {
        const optimistic = previous.map((item) => {
          if (item.title_id === newEntry.titleId) {
            const nextStatus = newEntry.status || item.status;
            const isPlanned = nextStatus === 'planned';
            return {
              ...item,
              status: nextStatus,
              rating: newEntry.rating !== undefined ? newEntry.rating : item.rating,
              episodes_watched: isPlanned ? [] : item.episodes_watched,
              last_chapter_read: isPlanned ? 0 : item.last_chapter_read,
              last_volume_read: isPlanned ? 0 : item.last_volume_read,
            };
          }
          return item;
        });
        queryClient.setQueryData(['library', newEntry.userId], optimistic);
      }

      return { previous };
    },
    onError: (_err, newEntry, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['library', newEntry.userId], context.previous);
      }
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: ['library', variables.userId] });
    },
  });
}

export function useUpdateItemStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      userId: string;
      titleId?: string;
      libraryId?: string;
      status: TrackingStatus;
    }) => updateItemStatus(params),
    onMutate: async (newEntry) => {
      await queryClient.cancelQueries({ queryKey: ['library', newEntry.userId] });
      const previous = queryClient.getQueryData<UserLibraryItem[]>(['library', newEntry.userId]);

      if (previous) {
        const isPlanned = newEntry.status === 'planned';
        const optimistic = previous.map((item) => {
          if (
            (newEntry.titleId && item.title_id === newEntry.titleId) ||
            (newEntry.libraryId && item.id === newEntry.libraryId)
          ) {
            return {
              ...item,
              status: newEntry.status,
              episodes_watched: isPlanned ? [] : item.episodes_watched,
              last_chapter_read: isPlanned ? 0 : item.last_chapter_read,
              last_volume_read: isPlanned ? 0 : item.last_volume_read,
            };
          }
          return item;
        });
        queryClient.setQueryData(['library', newEntry.userId], optimistic);
      }

      return { previous };
    },
    onError: (_err, newEntry, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['library', newEntry.userId], context.previous);
      }
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: ['library', variables.userId] });
    },
  });
}

export function useIncrementEpisode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      libraryId: string;
      userId: string;
      episodeId: string;
      watched: boolean;
    }) => logEpisodeProgress(params),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ['library', variables.userId] });
      const previous = queryClient.getQueryData<UserLibraryItem[]>(['library', variables.userId]);

      if (previous) {
        const optimistic = previous.map((item) => {
          if (item.id === variables.libraryId) {
            const watched = variables.watched
              ? [...new Set([...item.episodes_watched, variables.episodeId])]
              : item.episodes_watched.filter((id) => id !== variables.episodeId);

            const totalEpisodes = calculateTotalEpisodes(item.title);
            const watchedCount = calculateWatchedEpisodesCount(watched, item.title);
            const nextStatus = inferWatchedTrackingStatus({
              currentStatus: item.status,
              watchedCount,
              totalEpisodes,
            });

            return {
              ...item,
              episodes_watched: watched,
              status: nextStatus,
              started_at: nextStatus === 'planned' ? null : (item.started_at || new Date().toISOString()),
              completed_at: nextStatus === 'completed' ? (item.completed_at || new Date().toISOString()) : null,
            };
          }
          return item;
        });
        queryClient.setQueryData(['library', variables.userId], optimistic);
      }

      return { previous };
    },
    onError: (_err, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['library', variables.userId], context.previous);
      }
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: ['library', variables.userId] });
    },
  });
}

export function useBatchEpisodeProgress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      libraryId: string;
      userId: string;
      episodeIds: string[];
      watched: boolean;
    }) => logBatchEpisodeProgress(params),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ['library', variables.userId] });
      const previous = queryClient.getQueryData<UserLibraryItem[]>(['library', variables.userId]);

      if (previous) {
        const optimistic = previous.map((item) => {
          if (item.id === variables.libraryId) {
            const watched = variables.watched
              ? [...new Set([...item.episodes_watched, ...variables.episodeIds])]
              : item.episodes_watched.filter((id) => !variables.episodeIds.includes(id));

            const totalEpisodes = calculateTotalEpisodes(item.title);
            const watchedCount = calculateWatchedEpisodesCount(watched, item.title);
            const nextStatus = inferWatchedTrackingStatus({
              currentStatus: item.status,
              watchedCount,
              totalEpisodes,
            });

            return {
              ...item,
              episodes_watched: watched,
              status: nextStatus,
              started_at: nextStatus === 'planned' ? null : (item.started_at || new Date().toISOString()),
              completed_at: nextStatus === 'completed' ? (item.completed_at || new Date().toISOString()) : null,
            };
          }
          return item;
        });
        queryClient.setQueryData(['library', variables.userId], optimistic);
      }

      return { previous };
    },
    onError: (_err, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['library', variables.userId], context.previous);
      }
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: ['library', variables.userId] });
    },
  });
}

export function useIncrementChapter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      libraryId: string;
      userId: string;
      chapter: number;
      volume?: number;
    }) => logReadingProgress(params),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ['library', variables.userId] });
      const previous = queryClient.getQueryData<UserLibraryItem[]>(['library', variables.userId]);

      if (previous) {
        const optimistic = previous.map((item) =>
          item.id === variables.libraryId
            ? {
                ...item,
                last_chapter_read: variables.chapter,
                last_volume_read: variables.volume ?? item.last_volume_read,
                status:
                  variables.chapter > 0 &&
                  (!item.title.total_chapters || variables.chapter < item.title.total_chapters)
                    ? ('active' as TrackingStatus)
                    : item.status,
              }
            : item
        );
        queryClient.setQueryData(['library', variables.userId], optimistic);
      }

      return { previous };
    },
    onError: (_err, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['library', variables.userId], context.previous);
      }
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: ['library', variables.userId] });
    },
  });
}

export function useRemoveFromLibrary() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { libraryId: string; userId: string; titleId?: string }) =>
      removeLibraryItem(params.libraryId, params.userId, params.titleId),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ['library', variables.userId] });
      const previous = queryClient.getQueryData<UserLibraryItem[]>(['library', variables.userId]);

      if (previous) {
        queryClient.setQueryData(
          ['library', variables.userId],
          previous.filter(
            (item) =>
              item.id !== variables.libraryId &&
              (!variables.titleId || item.title_id !== variables.titleId)
          )
        );
      }

      return { previous };
    },
    onError: (_err, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['library', variables.userId], context.previous);
      }
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: ['library', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['watch_history', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['reading_history', variables.userId] });
    },
  });
}
