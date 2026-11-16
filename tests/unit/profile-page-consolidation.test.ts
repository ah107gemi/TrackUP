import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Profile Page Consolidation & Compact UI Suite', () => {
  const profilePagePath = path.resolve(__dirname, '../../src/features/profile/ProfilePage.tsx');
  const customListsSectionPath = path.resolve(__dirname, '../../src/features/custom-lists/CustomListsSection.tsx');

  describe('1. Tracking Overview & Showcases (Compact Summary Headers)', () => {
    it('verifies ProfilePage has compact summary headers for all 4 categories', () => {
      const code = fs.readFileSync(profilePagePath, 'utf8');

      // Verify compact testids exist
      expect(code).toContain('data-testid="profile-section-tv"');
      expect(code).toContain('data-testid="profile-section-movies"');
      expect(code).toContain('data-testid="profile-section-anime"');
      expect(code).toContain('data-testid="profile-section-reading"');

      // Verify watch/reading time testid badges exist
      expect(code).toContain('data-testid="tv-watch-time"');
      expect(code).toContain('data-testid="movies-watch-time"');
      expect(code).toContain('data-testid="anime-watch-time"');
      expect(code).toContain('data-testid="reading-watch-time"');

      // Verify category labels are present
      expect(code).toContain('TV Series');
      expect(code).toContain('Movies');
      expect(code).toContain('Anime');
      expect(code).toContain('Manga & Manhwa');
    });

    it('verifies interactive tracking showcase modal is present with detailed stats and media grid', () => {
      const code = fs.readFileSync(profilePagePath, 'utf8');

      expect(code).toContain('data-testid="tracking-showcase-modal"');
      expect(code).toContain('data-testid="close-showcase-modal"');
      expect(code).toContain('selectedShowcase');
      expect(code).toContain('showcaseConfig');
      expect(code).toContain('Tracked Titles');
      expect(code).toContain('onSelectTitle');
    });
  });

  describe('2. Favorite Collections (Compact Rows)', () => {
    it('verifies Favorite Collections utilizes compact rows while preserving View Collection routing', () => {
      const code = fs.readFileSync(profilePagePath, 'utf8');

      expect(code).toContain('data-testid="favorite-category-tv"');
      expect(code).toContain('data-testid="favorite-category-movie"');
      expect(code).toContain('data-testid="favorite-category-anime"');
      expect(code).toContain('data-testid="favorite-category-reading"');

      // Verify routing handler is called
      expect(code).toContain("handleSelectCategory('tv')");
      expect(code).toContain("handleSelectCategory('movie')");
      expect(code).toContain("handleSelectCategory('anime')");
      expect(code).toContain("handleSelectCategory('reading')");

      // Verify "View Collection" text and compact styling
      expect(code).toContain('View Collection');
      expect(code).toContain('Favorite Collections');
    });
  });

  describe('3. Custom Lists (Simplified Space-Saving Cards)', () => {
    it('verifies list cards remove descriptions and thumbnails, retaining only core indicators', () => {
      const code = fs.readFileSync(customListsSectionPath, 'utf8');

      // In the folder grid, previewPosters and descriptions should not be rendered
      expect(code).toContain('data-testid="custom-lists-folders-grid"');
      expect(code).toContain('data-testid={`custom-list-card-${list.id}`}');
      expect(code).toContain('data-testid={`custom-list-title-${list.id}`}');
      expect(code).toContain('data-testid={`custom-list-view-btn-${list.id}`}');

      // Verify card elements: folder icon, list name, item count, public/private badge, view button
      expect(code).toContain('<Folder');
      expect(code).toContain('list.is_private');
      expect(code).toContain('itemCount');
      expect(code).toContain('View');
      expect(code).toContain('ChevronRight');

      // Verify description is NOT rendered inside the folder summary card
      const gridSectionMatch = code.match(/data-testid="custom-lists-folders-grid"[\s\S]*?<\/div>\s*\)\s*;\s*\}\)\}\s*<\/div>/);
      expect(gridSectionMatch).toBeTruthy();
      const gridSectionCode = gridSectionMatch![0];

      expect(gridSectionCode).not.toContain('list.description');
      expect(gridSectionCode).not.toContain('previewPosters');
    });
  });
});
