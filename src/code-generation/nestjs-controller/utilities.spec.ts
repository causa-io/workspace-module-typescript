import {
  computeSubPath,
  deriveMethodName,
  resolveRefPath,
} from './utilities.js';

describe('utilities', () => {
  describe('computeSubPath', () => {
    it('should return empty string when path equals base path', () => {
      expect(computeSubPath('/posts', '/posts')).toEqual('');
    });

    it('should return remainder after base path', () => {
      expect(computeSubPath('/posts/{id}', '/posts')).toEqual(':id');
      expect(computeSubPath('/posts/{id}/publish', '/posts')).toEqual(
        ':id/publish',
      );
    });

    it('should replace path parameters with colon syntax', () => {
      expect(
        computeSubPath('/posts/{postId}/comments/{commentId}', '/posts'),
      ).toEqual(':postId/comments/:commentId');
    });

    it('should handle paths without parameters', () => {
      expect(computeSubPath('/posts/searchKey', '/posts')).toEqual('searchKey');
    });
  });

  describe('deriveMethodName', () => {
    it('should strip resource name prefix', () => {
      expect(deriveMethodName('postCreate', 'Post')).toEqual('create');
      expect(deriveMethodName('postImportJobRetry', 'PostImportJob')).toEqual(
        'retry',
      );
    });

    it('should lowercase the first letter', () => {
      expect(deriveMethodName('postSubmitForReview', 'Post')).toEqual(
        'submitForReview',
      );
    });

    it('should return operationId as-is if no prefix match', () => {
      expect(deriveMethodName('createPost', 'Post')).toEqual('createPost');
    });
  });

  describe('resolveRefPath', () => {
    it('should resolve relative refs', () => {
      const result = resolveRefPath(
        '../entities/post.yaml',
        '/project/api/post.api.yaml',
      );
      expect(result).toEqual('/project/entities/post.yaml');
    });

    it('should handle refs with fragments', () => {
      const result = resolveRefPath(
        '../entities/post.yaml#/$defs/PostState',
        '/project/api/post.api.yaml',
      );
      expect(result).toEqual('/project/entities/post.yaml');
    });

    it('should return same file for fragment-only refs', () => {
      const result = resolveRefPath(
        '#/$defs/PostState',
        '/project/api/post.api.yaml',
      );
      expect(result).toEqual('/project/api/post.api.yaml');
    });
  });
});
