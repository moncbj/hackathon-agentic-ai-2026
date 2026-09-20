-- SPEC-004: assessment grade and learner-state updates are one atomic operation.
CREATE OR REPLACE FUNCTION submit_assessment_transaction(
  p_assessment_id uuid, p_learner_id uuid, p_skill_id uuid,
  p_level int, p_verification text, p_status text, p_progress int, p_consecutive_failures int,
  p_status_updates jsonb, p_answers jsonb, p_score numeric, p_measured_level int,
  p_passed boolean, p_feedback jsonb
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE item jsonb;
BEGIN
  UPDATE learner_skills SET level=p_level, verification=p_verification, status=p_status,
    progress=p_progress, consecutive_failures=p_consecutive_failures, updated_at=now()
  WHERE learner_id=p_learner_id AND skill_id=p_skill_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'learner skill not found'; END IF;
  FOR item IN SELECT * FROM jsonb_array_elements(p_status_updates) LOOP
    UPDATE learner_skills SET status=item->>'status', updated_at=now()
    WHERE learner_id=p_learner_id AND skill_id=(item->>'skillId')::uuid;
    IF NOT FOUND THEN RAISE EXCEPTION 'learner skill status target not found'; END IF;
  END LOOP;
  UPDATE assessments SET answers=p_answers, score=p_score, measured_level=p_measured_level,
    passed=p_passed, feedback=p_feedback, status='graded', graded_at=now()
  WHERE id=p_assessment_id AND status='generated';
  IF NOT FOUND THEN RAISE EXCEPTION 'assessment is not generated'; END IF;
END;
$$;
