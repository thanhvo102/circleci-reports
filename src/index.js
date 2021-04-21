const axios = require("axios");
const { chunk } = require("lodash");

const ORG_SLUG = "gh/remitano";
const { CIRCLE_TOKEN } = process.env;

const getPipelinesByPage = async (pageToken) => {
  const response = await axios.get(
    "https://circleci.com/api/v2/pipeline",
    {
      headers: {
        "Circle-Token": CIRCLE_TOKEN,
      },
      params: {
        "org-slug": ORG_SLUG,
        "page-token": pageToken,
      },
    },
  );

  return response.data;
};

const getPipelineWorkflows = async (pipelineId) => {
  const response = await axios.get(
    `https://circleci.com/api/v2/pipeline/${pipelineId}/workflow`,
    {
      headers: {
        "Circle-Token": CIRCLE_TOKEN,
      },
    },
  );

  return response.data;
};

const getPipelineIds = async (branch, count) => {
  let pipelineIds = [];
  let pageToken;

  while (pipelineIds.length < count) {
    const {
      items,
      next_page_token: nextPageToken,
    } = await getPipelinesByPage(pageToken);

    pageToken = nextPageToken;
    const nextPipelineIds = items.filter(item => item.vcs.branch === branch)
      .map(item => item.id);

    pipelineIds = [...pipelineIds, ...nextPipelineIds];

    if (pipelineIds.length >= count || !nextPageToken) {
      return pipelineIds.slice(0, count);
    }
  }
};

const getPipelineStatus = async (pipelineId) => {
  const { items } = await getPipelineWorkflows(pipelineId);

  return items[items.length - 1].status;
};



const getPipelinesStatusSummary = async (pipelineIds) => {
  const BATCH_SIZE = 25;
  let pipelineStatuses = [];

  const batches = chunk(pipelineIds, BATCH_SIZE);

  for (const batch of batches) {
    const batchStatuses = await Promise.all(
      batch.map(id => getPipelineStatus(id)),
    );

    pipelineStatuses = [...pipelineStatuses, ...batchStatuses];
  }

  const summary = {
    failed: 0,
    running: 0,
    success: 0,
  };

  pipelineStatuses.reduce((accumulator, status) => {
    accumulator[status] += 1;

    return accumulator;
  }, summary);

  return summary;
};

getPipelineIds("master", 100).then((ids) => {
  getPipelinesStatusSummary(ids).then((count) => {
    console.log(count);
  });
});
