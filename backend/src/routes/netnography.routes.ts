import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import {
  addSourceToStudy,
  createStudy,
  deleteStudy,
  extractStudySources,
  getStudyDetail,
  getValidationQueue,
  getViralSignals,
  getStudyInfographicSvg,
  importCorpusRows,
  listStudies,
  recomputeAnalysis,
  submitManualLabel,
  triggerOrAdvanceAnalysis,
  updateFieldDiary,
} from "../controllers/netnography.controller";

const router = Router();

router.use(authenticate);

router.get("/signals", getViralSignals);
router.get("/studies", listStudies);
router.post("/studies", createStudy);
router.get("/studies/:id", getStudyDetail);
router.get("/studies/:id/infographic.svg", getStudyInfographicSvg);
router.delete("/studies/:id", deleteStudy);
router.post("/studies/:id/sources", addSourceToStudy);
router.post("/studies/:id/import", importCorpusRows);
router.post("/studies/:id/extract", extractStudySources);
router.post("/studies/:id/analyze", triggerOrAdvanceAnalysis);
router.get("/studies/:id/validation-queue", getValidationQueue);
router.patch("/labels/:labelId", submitManualLabel);
router.post("/analyses/:analysisId/recompute", recomputeAnalysis);
router.patch("/analyses/:analysisId/diary", updateFieldDiary);

export default router;
