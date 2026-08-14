const express = require("express");
const prisma = require("../database/client");
const {
  info,
  watch,
  latest,
  search,
  onGoing,
  recomendation,
} = require("../scripts/samehadaku.crawler");

const router = express();

const logUpstreamError = (route, error) => {
  console.error(`[samehadaku:${route}]`, {
    message: error.message,
    code: error.code,
    status: error.response?.status,
    url: error.config?.url,
  });
};

router.get("/search", async (req, res) => {
  try {
    const { q } = req.query;
    const response = await search(q);
    return res.json({
      data: response,
    });
  } catch (error) {
    logUpstreamError("search", error);
    return res.status(500).json({
      error: "Server Error",
      message: "Cant't fetch resources from server",
    });
  }
});

router.get("/recomendation", async (req, res) => {
  try {
    const response = await recomendation();
    return res.json(response);
  } catch (error) {
    logUpstreamError("recomendation", error);
    return res.status(500).json({
      error: "Server Error",
      message: "Cant't fetch resources from server",
    });
  }
});

router.get("/servers", async (req, res) => {
  const servers = await prisma.animeServer.findMany();

  return res.json({
    data: servers,
  });
});

router.get("/ongoing", async (req, res) => {
  try {
    const response = await onGoing();

    return res.json({
      data: response,
    });
  } catch (error) {
    logUpstreamError("ongoing", error);
    return res.status(500).json({
      error: "Server Error",
      message: "Cant't fetch resources from server",
    });
  }
});

router.get("/latest", async (req, res) => {
  try {
    const { page } = req.query;

    const response = await latest(page ? page : 1);

    return res.json(response);
  } catch (error) {
    logUpstreamError("latest", error);
    return res.status(500).json({
      error: "Server Error",
      message: "Cant't fetch resources from server",
    });
  }
});

router.get("/info/:animeId", async (req, res) => {
  try {
    const { animeId } = req.params;
    const response = await info(animeId);

    return res.json({
      data: response,
    });
  } catch (error) {
    logUpstreamError("info", error);
    return res.status(500).json({
      error: "Server Error",
      message: "Cant't fetch resources from server",
    });
  }
});

router.get("/watch/:serverName/:episodeId", async (req, res) => {
  try {
    const { serverName, episodeId } = req.params;
    const server = await prisma.animeServer.findFirst({
      where: { name: serverName },
    });

    if (!server) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Unsuported Server",
      });
    }

    const response = await watch(serverName, episodeId);

    return res.json(response);
  } catch (error) {
    logUpstreamError("watch", error);
    return res.status(500).json({
      error: "Server Error",
      message: "Cant't fetch resources from server",
    });
  }
});

module.exports = router;
