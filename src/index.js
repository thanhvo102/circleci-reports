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

const getPipelineIds = async (repo, branch, count) => {
  let pipelineIds = [];
  let pageToken;

  const projectSlug = `gh/remitano/${repo}`;
  const backupCount = count + 20; // in case there are cancelled pipelines

  while (pipelineIds.length < backupCount) {
    const {
      items,
      next_page_token: nextPageToken,
    } = await getPipelinesByPage(pageToken);

    pageToken = nextPageToken;
    const nextPipelineIds = items
      .filter(item => item.project_slug === projectSlug && item.vcs.branch === branch)
      .map(item => {
        // DEBUG
        // console.log(item.id);
        // console.log(item.vcs.commit.subject);
        return item.id;
      });

    pipelineIds = [...pipelineIds, ...nextPipelineIds];

    if (pipelineIds.length >= backupCount || !nextPageToken) {
      return pipelineIds.slice(0, backupCount);
    }
  }
};

const getPipelineStatus = async (pipelineId) => {
  const { items } = await getPipelineWorkflows(pipelineId);

  // Get status of the first workflow (at the end of the array)
  return items[items.length - 1].status;
};



const getPipelinesStatusSummary = async (pipelineIds, count) => {
  const BATCH_SIZE = 25;
  let pipelineStatuses = [];

  const batches = chunk(pipelineIds, BATCH_SIZE);

  for (const batch of batches) {
    const batchStatuses = await Promise.all(
      batch.map(id => getPipelineStatus(id)),
    );

    pipelineStatuses = [...pipelineStatuses, ...batchStatuses];
  }

  // DEBUG
  // console.log(pipelineIds);
  // console.log(pipelineStatuses);
  // console.log(pipelineStatuses.length);

  pipelineStatuses = pipelineStatuses
    .filter(status => status !== "canceled")
    .slice(0, count);

  // DEBUG
  // console.log(pipelineStatuses);
  // console.log(pipelineStatuses.length);

  const summary = {};

  pipelineStatuses.reduce((accumulator, status) => {
    if (accumulator[status] === undefined) {
      accumulator[status] = 0;
    }
    accumulator[status] += 1;

    return accumulator;
  }, summary);

  return summary;
};

const REPO = "remitano";
const BRANCH = "master"
const PIPELINES_COUNT = 100;

getPipelineIds(REPO, BRANCH, PIPELINES_COUNT).then((ids) => {
  getPipelinesStatusSummary(ids, PIPELINES_COUNT).then((count) => {
    console.log(count);
  });
});
