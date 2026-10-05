# Learning Room P3 HTTP 契约

2026-10-05。权威实现：server/src/routes/learning.js、services/learningRoom.js、services/learningAssessment.js 及两份新 SQL migration。Expo 通过现有 requestApi 发送 Device-ID＋Device-Credential，不能直接访问 Supabase。

所有路径前缀 `/api/learning`。mutation 只接收下列字段，多余 score／passed／deviceId／learnerUid 一律 400。UUID 为服务端生成；createKey／requestKey 使用 8–100 位英数字、`_`、`-`，UUID 字符串可直接使用。网络重试必须复用原键。

| 方法／路径 | JSON body | 响应 |
| --- | --- | --- |
| GET catalog | 无 | `{content: PublicLearningContent}`，完整双语投影 |
| GET state | 无 | State |
| GET courses/:courseCode | 无 | `{contentVersion,course,activities}` |
| GET activities/:activityCode | 无 | `{contentVersion,activity,sources}`，也接受 resourceCode |
| PUT activities/:code/completion | `{contentVersion,requestKey}` | State；video／lesson／resource 可完成，practice 必须结算考试 |
| POST attempts | `{stageCode,mode,createKey,activityCode?}` | Attempt；activityCode 仅 practice 使用 |
| GET attempts/:uid | 无 | Attempt |
| POST attempts/:uid/answers | `{questionUid,optionId,requestKey}` | Attempt 的 quiz 为本次首答反馈 |
| POST attempts/:uid/next | `{requestKey}` | Attempt；首答后才可推进 |
| POST attempts/:uid/finish | `{requestKey}` | Attempt.result；事务判分并返回个人等级 |
| POST attempts/:uid/abandon | `{requestKey}` | Attempt.status，保留历史 |
| GET attempts/:uid/review?missedOnly=true | 无 | State＋`{status,attemptContentVersion,questions,sources}`；只展示已答题 |

State 字段：`contentVersion`、`stateVersion`（字符串 bigint）、`session`、`activeAttemptUid`、`recentResults`。session 与 `src/types/learningRoom.ts` 的 LearningSessionView 同形。recentResults 最多十条本人已结算摘要（attemptUid／stageCode／mode／correctCount／totalCount／passed／submittedAt）。

Attempt 继承 State，并含 status、attemptContentVersion、sources。进行中有 `quiz: LearningQuizView`；结算后有 `result: LearningResultView`；abandoned 没有可答 quiz。sources 仅包含已答题冻结来源；quiz.feedback 在首答前为 null，首答后才含正确选项与解释。读取旧考试时 contentVersion 是当前目录版本，attemptContentVersion 是该考试冻结版本，两者不能混用。finish 的 passed 为权威整数判定；scorePercent 仅用于显示。

模式：checkpoint 6／8／10 题，通过需 5／7／8；review 使用相同 blueprint，不改变阶段；practice 固定对应活动三题，全部答完结算即完成活动，不要求满分；mixed-review 为高级已通过后十二题（每级四题），不解锁。课程与资料不锁。个人活动完成不改变正式阶段资格。

幂等：同 stage／mode／activity 的 active 考试会恢复，不覆盖选题。所有创建键永久绑定该考试，包括用新键恢复的请求；完成后重发仍返回旧结果。答案第一次提交后不可换选项，相同选项重试返回已持久化结果；同一请求键不能用于别题或别选项。next 的键绑定一次推进；finish 并发只结算一次。completion 按 learner＋code＋版本自然幂等，requestKey 仅格式验证、不作为写入去重键。

| HTTP | error |
| --- | --- |
| 400 | invalid_input、invalid_question_selection |
| 401 | invalid_device／invalid_device_credential／no_device（鉴权边界） |
| 403 | learning_stage_locked |
| 404 | attempt_not_found、activity_not_found；他人考试同样 404 |
| 409 | answer_already_submitted、learning_question_not_current、learning_answer_required、attempt_not_active、attempt_incomplete、idempotency_key_conflict、learning_practice_requires_attempt、learning_content_changed |
| 410 | attempt_invalidated |
| 503 | content_unavailable、learning_unavailable |

普通失败结果仍为 200，passed=false。未知数据库错误只返回 learning_unavailable，绝不输出 SQL、记录或凭证。撤回时未完成考试失效，已通过资格与结果保留。普通服务默认只读取 published；开发草稿例外必须双开关＋确切开发域名，production 禁用。

P4 映射：gateway.load 并行 GET catalog＋state；startQuiz／resumeQuiz／submitAnswer／nextQuestion 读取 Attempt.quiz；finishQuiz 读取 Attempt.result；reviewMissed 读取 questions；markActivity／markResource PUT completion 并读取 session。需补 activityCode 参数、abandon 操作、sources 和错误处理，不能将已结算／失效考试强转成 quiz。重试键需在一次用户操作内保留；完成或设备恢复后清理定位缓存。
