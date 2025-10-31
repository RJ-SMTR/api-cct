export type BigQueryError = {
  bigquery: {
    errors: Array<{
      reason: string;
      location: string;
      message: string;
    }>;
    response: {
      kind: string;
      etag: string;
      id: string;
      selfLink: string;
      user_email: string;
      configuration: {
        query: {
          query: string;
          priority: string;
          useLegacySql: boolean;
        };
        jobType: string;
      };
      jobReference: {
        projectId: string;
        jobId: string;
        location: string;
      };
      statistics: {
        creationTime: string;
        startTime: string;
        endTime: string;
        query: {
          totalSlotMs: string;
          cacheHit: boolean;
          referencedTables: Array<{
            projectId: string;
            datasetId: string;
            tableId: string;
          }>;
          statementType: string;
        };
        totalSlotMs: string;
      };
      status: {
        errorResult: {
          reason: string;
          location: string;
          message: string;
        };
        errors: Array<{
          reason: string;
          location: string;
          message: string;
        }>;
        state: string;
      };
      principal_subject: string;
      jobCreationReason: {
        code: string;
      };
    };
    message: string;
  };
};
