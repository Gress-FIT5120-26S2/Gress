import type { PublicLearningContent } from '../../../types/learningContent';

// Arthur: NarIyirm
// 中文：由公开投影生成的 P2 草稿预览，不包含题库，也不是已发布 catalog。
// EN: Generated P2 draft preview from the public projection; this is neither a question bank nor a published catalog.
export const learningPreviewContent = {
  "schemaVersion": 1,
  "contentVersion": "learning-room-v1",
  "projectSdg": {
    "goal": 13,
    "target": "13.3"
  },
  "languages": [
    "en",
    "zh"
  ],
  "stages": [
    {
      "stageCode": "beginner",
      "title": {
        "en": "Beginner",
        "zh": "初级"
      },
      "courseCode": "waste-basics",
      "questionCount": 6,
      "passPercent": 80,
      "minimumCorrect": 5,
      "minimumBankSize": 12,
      "nextStageCode": "intermediate",
      "blueprint": [
        {
          "topicCode": "materials",
          "count": 2
        },
        {
          "topicCode": "sorting",
          "count": 2
        },
        {
          "topicCode": "causes",
          "count": 1
        },
        {
          "topicCode": "climate-basics",
          "count": 1
        }
      ]
    },
    {
      "stageCode": "intermediate",
      "title": {
        "en": "Intermediate",
        "zh": "中级"
      },
      "courseCode": "packaging-recycling",
      "questionCount": 8,
      "passPercent": 80,
      "minimumCorrect": 7,
      "minimumBankSize": 16,
      "nextStageCode": "advanced",
      "blueprint": [
        {
          "topicCode": "components",
          "count": 2
        },
        {
          "topicCode": "clean-streams",
          "count": 2
        },
        {
          "topicCode": "local-collection",
          "count": 2
        },
        {
          "topicCode": "reuse-resources",
          "count": 2
        }
      ]
    },
    {
      "stageCode": "advanced",
      "title": {
        "en": "Advanced",
        "zh": "高级"
      },
      "courseCode": "preventing-waste",
      "questionCount": 10,
      "passPercent": 80,
      "minimumCorrect": 8,
      "minimumBankSize": 20,
      "nextStageCode": null,
      "blueprint": [
        {
          "topicCode": "planning",
          "count": 3
        },
        {
          "topicCode": "storage-safety",
          "count": 2
        },
        {
          "topicCode": "prevention-priority",
          "count": 2
        },
        {
          "topicCode": "climate-evidence",
          "count": 3
        }
      ]
    }
  ],
  "courses": [
    {
      "courseCode": "waste-basics",
      "stageCode": "beginner",
      "title": {
        "en": "Waste basics",
        "zh": "浪费基础"
      },
      "summary": {
        "en": "Learn what waste is, then practise sorting it.",
        "zh": "了解浪费，再练习辨认和分类。"
      },
      "objective": {
        "en": "By the end, you can identify waste materials.",
        "zh": "学完后，你能辨认常见废弃物材料。"
      },
      "coverAssetKey": "waste-basics-course-cover",
      "activityCodes": [
        "beginner-why-waste",
        "beginner-materials",
        "beginner-bin-action"
      ],
      "relatedResourceCodes": [
        "waste-climate-sdg13",
        "local-sorting-guide"
      ]
    },
    {
      "courseCode": "packaging-recycling",
      "stageCode": "intermediate",
      "title": {
        "en": "Packaging & recycling",
        "zh": "包装与回收"
      },
      "summary": {
        "en": "Separate parts, avoid contamination and check the right collection.",
        "zh": "分清包装部件、避免污染，找到合适的收集服务。"
      },
      "objective": {
        "en": "By the end, you can check each packaging component and its collection route.",
        "zh": "学完后，你能核对每个包装部件及其收集方式。"
      },
      "coverAssetKey": "packaging-recycling-cover",
      "activityCodes": [
        "intermediate-components",
        "intermediate-clean-streams",
        "intermediate-local-guide"
      ],
      "relatedResourceCodes": [
        "materials-and-components",
        "local-sorting-guide"
      ]
    },
    {
      "courseCode": "preventing-waste",
      "stageCode": "advanced",
      "title": {
        "en": "Preventing waste",
        "zh": "减少浪费"
      },
      "summary": {
        "en": "Use what you have, store with care and understand the climate link.",
        "zh": "先用已有食物、注意储存，理解浪费与气候的联系。"
      },
      "objective": {
        "en": "By the end, you can plan a practical waste prevention action.",
        "zh": "学完后，你能制定可行的减废行动。"
      },
      "coverAssetKey": "preventing-waste-cover",
      "activityCodes": [
        "advanced-plan-first",
        "advanced-storage",
        "advanced-climate"
      ],
      "relatedResourceCodes": [
        "plan-before-shopping",
        "date-labels-and-storage",
        "waste-climate-sdg13"
      ]
    }
  ],
  "libraryTopics": [
    {
      "topicCode": "waste-basics",
      "title": {
        "en": "Waste basics",
        "zh": "浪费基础"
      }
    },
    {
      "topicCode": "recycling",
      "title": {
        "en": "Recycling",
        "zh": "回收"
      }
    },
    {
      "topicCode": "preventing-waste",
      "title": {
        "en": "Preventing waste",
        "zh": "减少浪费"
      }
    },
    {
      "topicCode": "waste-climate",
      "title": {
        "en": "Waste & climate",
        "zh": "浪费与气候"
      }
    }
  ],
  "media": [
    {
      "mediaAssetKey": "food-waste-linear-story",
      "type": "video",
      "durationSeconds": 60,
      "assetPath": "assets/story/food-waste/kitchmemo-food-waste-linear-60s.mp4",
      "posterPath": "assets/story/food-waste/poster.png",
      "sourceRefs": [
        "ozharvest-2025"
      ]
    }
  ],
  "assessmentRules": {
    "answerKind": "single-choice",
    "timeLimitSeconds": null,
    "firstAnswerFinal": true,
    "gradingAuthority": "server",
    "unlockAuthority": "atomic-finish",
    "requiredActivitiesBeforeCheckpoint": false,
    "courseReadingRequiresUnlock": false,
    "personalProgress": true,
    "addsSharedXp": false,
    "changesInventory": false,
    "reviewCanUnlock": false,
    "practiceCanUnlock": false,
    "percentageRounding": "display-only",
    "completionAfterAdvanced": "mixed-review"
  },
  "errorCodes": [
    "invalid_input",
    "learning_stage_locked",
    "attempt_not_found",
    "attempt_not_active",
    "answer_already_submitted",
    "attempt_incomplete",
    "content_unavailable",
    "learning_unavailable"
  ],
  "activities": [
    {
      "activityCode": "beginner-why-waste",
      "contentVersion": "learning-room-v1",
      "stageCode": "beginner",
      "type": "video",
      "title": {
        "en": "Why food gets wasted",
        "zh": "食物为什么被浪费"
      },
      "objective": {
        "en": "Notice how everyday habits can leave food unused.",
        "zh": "发现日常习惯如何让食物未被使用。"
      },
      "durationEstimate": {
        "minutes": 1,
        "includesReflection": false,
        "basis": {
          "en": "Estimated lesson and activity time; no timer.",
          "zh": "课程与活动预计时间；没有倒计时。"
        }
      },
      "mediaAssetKey": "food-waste-linear-story",
      "sourceRefs": [
        "ozharvest-2025"
      ],
      "relatedActivityCodes": [
        "beginner-materials"
      ],
      "nextActivityCode": "beginner-materials",
      "completionKind": "explicit-confirmation",
      "body": [
        {
          "type": "paragraph",
          "text": {
            "en": "Watch the one-minute story, or read this summary. Food can slip out of sight while shopping and meal plans move on. Checking what is already at home creates a useful pause before buying more.",
            "zh": "观看一分钟故事，或阅读这份摘要。购物和餐食安排不断变化，食物却可能被遗忘。多买之前先查看家里已有的食物，是一个有用的停顿。"
          }
        },
        {
          "type": "paragraph",
          "text": {
            "en": "OzHarvest's 2025 research describes Australian households with someone under 35 discarding about 113 kg of food a year, valued at over A$1,500. This is a survey estimate for that group, not a measurement of you.",
            "zh": "OzHarvest 2025 年研究估计，有 35 岁以下成员的澳大利亚家庭每年丢弃约 113 kg 食物，价值超过 A$1,500。这是该群体的调查估计，不是对你的测量。"
          }
        },
        {
          "type": "reflection",
          "title": {
            "en": "Try it in your kitchen",
            "zh": "在你的厨房试一试"
          },
          "text": {
            "en": "Name one ingredient you already have that could be part of your next meal.",
            "zh": "找出一种家里已有、可以用于下一餐的食材。"
          }
        },
        {
          "type": "source",
          "sourceRefs": [
            "ozharvest-2025"
          ]
        }
      ]
    },
    {
      "activityCode": "beginner-materials",
      "contentVersion": "learning-room-v1",
      "stageCode": "beginner",
      "type": "lesson",
      "title": {
        "en": "Know your materials",
        "zh": "认识材料"
      },
      "objective": {
        "en": "Identify a material before choosing its collection route.",
        "zh": "先辨认材料，再选择收集方式。"
      },
      "durationEstimate": {
        "minutes": 4,
        "includesReflection": true,
        "basis": {
          "en": "Estimated lesson and activity time; no timer.",
          "zh": "课程与活动预计时间；没有倒计时。"
        }
      },
      "mediaAssetKey": "waste-basics-course-cover",
      "sourceRefs": [
        "vic-sorting",
        "arl"
      ],
      "relatedActivityCodes": [
        "beginner-bin-action"
      ],
      "nextActivityCode": "beginner-bin-action",
      "completionKind": "explicit-confirmation",
      "body": [
        {
          "type": "paragraph",
          "text": {
            "en": "Start with what the item actually is. Food scraps, metal, paper, glass and plastics have different roles. A package can contain several of them. A silver-looking object or an illustration alone does not prove a material.",
            "zh": "先确认物品本身是什么。食物残余、金属、纸、玻璃和塑料是不同类别；一件包装可能包含多种材料。银色外观或插图本身不能证明材质。"
          }
        },
        {
          "type": "bullet-list",
          "items": [
            {
              "en": "Confirmed aluminium → metal.",
              "zh": "已确认的铝 → 金属。"
            },
            {
              "en": "Plain cardboard → paper-based material.",
              "zh": "普通纸板 → 纸类材料。"
            },
            {
              "en": "Fruit peel → food residue.",
              "zh": "果皮 → 食物残余。"
            },
            {
              "en": "Scrunchable plastic film → soft plastic, not a rigid container.",
              "zh": "可揉团的塑料薄膜 → 软塑料，不是硬容器。"
            }
          ]
        },
        {
          "type": "paragraph",
          "text": {
            "en": "Now check the route. Read instructions for each packaging part and the local service. A recycling triangle or plastic code does not by itself confirm that your council accepts the item. When uncertain, look it up instead of adding it to recycling.",
            "zh": "再核对处理方式。查看各包装部件说明与当地服务。回收三角符号或塑料编号本身并不保证当地 council 接受该物品。不确定时先查，不直接塞进回收。"
          }
        },
        {
          "type": "paragraph",
          "text": {
            "en": "Example: a snack has a cardboard sleeve and a soft-plastic wrapper. Identify both parts; do not let the sleeve's recycling instruction stand in for the wrapper's.",
            "zh": "例子：零食有纸板套和软塑料膜。应分别辨认，不能把纸板套的回收说明套用到薄膜上。"
          }
        },
        {
          "type": "reflection",
          "title": {
            "en": "Try it in your kitchen",
            "zh": "在你的厨房试一试"
          },
          "text": {
            "en": "Choose one package at home. Find its parts, material clues and collection instructions. If something is missing, note what you need to check.",
            "zh": "选一件家里的包装，找出部件、材质线索和收集说明。若信息不足，记下需要核对的内容。"
          }
        },
        {
          "type": "source",
          "sourceRefs": [
            "vic-sorting",
            "arl"
          ]
        }
      ]
    },
    {
      "activityCode": "beginner-bin-action",
      "contentVersion": "learning-room-v1",
      "stageCode": "beginner",
      "type": "practice",
      "title": {
        "en": "Practise with Bin Action",
        "zh": "分类练习"
      },
      "objective": {
        "en": "Apply three clearly stated collection examples.",
        "zh": "练习三个服务条件明确的分类示例。"
      },
      "durationEstimate": {
        "minutes": 2,
        "includesReflection": true,
        "basis": {
          "en": "Estimated lesson and activity time; no timer.",
          "zh": "课程与活动预计时间；没有倒计时。"
        }
      },
      "mediaAssetKey": null,
      "sourceRefs": [
        "vic-sorting",
        "vic-fogo"
      ],
      "relatedActivityCodes": [],
      "nextActivityCode": null,
      "completionKind": "verified-practice",
      "body": [
        {
          "type": "paragraph",
          "text": {
            "en": "Practise with an empty aluminium can, a banana peel and a clean cardboard box. Each question states what the example service accepts. Choose by tapping a bin, or use the drag interaction when available.",
            "zh": "练习空铝罐、香蕉皮和干净纸箱。每题会说明示例服务接受什么。可以点选桶，或在可用时拖拽物品。"
          }
        },
        {
          "type": "paragraph",
          "text": {
            "en": "Read the explanation after each first answer. A demonstration retry helps you learn, but does not replace the recorded first answer. Finish all three feedback steps to complete this activity.",
            "zh": "首次作答后阅读解释。再次演示有助于学习，但不会改写首次答案。确认三题反馈后完成此活动。"
          }
        },
        {
          "type": "paragraph",
          "text": {
            "en": "This practice uses teaching items. It does not consume fridge stock or count as a real disposal. Your Beginner checkpoint remains a separate six-question assessment.",
            "zh": "练习使用教学物品，不消耗冰箱库存，也不算真实投放。初级 checkpoint 是另外的六题测验。"
          }
        },
        {
          "type": "reflection",
          "title": {
            "en": "Try it in your kitchen",
            "zh": "在你的厨房试一试"
          },
          "text": {
            "en": "What detail in the collection instructions changed your decision?",
            "zh": "收集说明中的哪个细节影响了你的选择？"
          }
        },
        {
          "type": "source",
          "sourceRefs": [
            "vic-sorting",
            "vic-fogo"
          ]
        }
      ]
    },
    {
      "activityCode": "intermediate-components",
      "contentVersion": "learning-room-v1",
      "stageCode": "intermediate",
      "type": "lesson",
      "title": {
        "en": "One item, several materials",
        "zh": "一件物品，多种材料"
      },
      "objective": {
        "en": "Read and separate packaging components appropriately.",
        "zh": "正确阅读并分清包装部件。"
      },
      "durationEstimate": {
        "minutes": 3,
        "includesReflection": true,
        "basis": {
          "en": "Estimated lesson and activity time; no timer.",
          "zh": "课程与活动预计时间；没有倒计时。"
        }
      },
      "mediaAssetKey": "packaging-recycling-cover",
      "sourceRefs": [
        "arl",
        "vic-sorting",
        "vic-reuse",
        "vic-glass"
      ],
      "relatedActivityCodes": [
        "intermediate-clean-streams"
      ],
      "nextActivityCode": "intermediate-clean-streams",
      "completionKind": "explicit-confirmation",
      "body": [
        {
          "type": "paragraph",
          "text": {
            "en": "One product does not always mean one disposal instruction. A box, inner wrap and lid may have different instructions. Find the name of each part, then read the instruction attached to that part.",
            "zh": "一个产品不一定只有一种处理说明。盒、内膜和盖子可能各有要求。先找到部件名称，再阅读属于该部件的说明。"
          }
        },
        {
          "type": "paragraph",
          "text": {
            "en": "The Australasian Recycling Label distinguishes recyclable, conditionally recyclable and not recyclable components. A condition may require preparation or a collection route. Do not skip it or apply one part's symbol to everything.",
            "zh": "Australasian Recycling Label 区分可回收、有条件可回收和不可回收部件。条件可能要求准备步骤或特定收集方式，不能跳过，也不能把一个部件的标识当作全部包装的说明。"
          }
        },
        {
          "type": "paragraph",
          "text": {
            "en": "Example: after safely using the food in a tub, separate any residue from the packaging. Check the tub and lid instructions. For glass jar lids, the council's rules can differ; do not assume every lid stays on or off.",
            "zh": "例子：安全使用盒中食物后，将残余与包装分开，查看盒身与盖子的说明。玻璃罐盖的 council 规则可能不同，不要认为所有盖子都应保留或取下。"
          }
        },
        {
          "type": "reflection",
          "title": {
            "en": "Try it in your kitchen",
            "zh": "在你的厨房试一试"
          },
          "text": {
            "en": "Read a multi-part package. Can you name the instruction for every part? Only separate parts in the way the instructions require.",
            "zh": "阅读一个多部件包装。你能说出每个部件的要求吗？只按说明要求分离。"
          }
        },
        {
          "type": "source",
          "sourceRefs": [
            "arl",
            "vic-sorting",
            "vic-reuse",
            "vic-glass"
          ]
        }
      ]
    },
    {
      "activityCode": "intermediate-clean-streams",
      "contentVersion": "learning-room-v1",
      "stageCode": "intermediate",
      "type": "lesson",
      "title": {
        "en": "Keep recycling useful",
        "zh": "避免回收污染"
      },
      "objective": {
        "en": "Prepare accepted items without contaminating a collection.",
        "zh": "按要求准备可接受物品，避免污染收集流。"
      },
      "durationEstimate": {
        "minutes": 4,
        "includesReflection": true,
        "basis": {
          "en": "Estimated lesson and activity time; no timer.",
          "zh": "课程与活动预计时间；没有倒计时。"
        }
      },
      "mediaAssetKey": "packaging-recycling-cover",
      "sourceRefs": [
        "vic-sorting",
        "vic-fogo",
        "vic-glass"
      ],
      "relatedActivityCodes": [
        "intermediate-local-guide"
      ],
      "nextActivityCode": "intermediate-local-guide",
      "completionKind": "explicit-confirmation",
      "body": [
        {
          "type": "paragraph",
          "text": {
            "en": "A collection stream works best when it contains the items the service expects. Extra food, plastic bags or the wrong material can make recovery harder. Preparation follows the receiving service, not a universal ritual.",
            "zh": "收集流中最好只包含该服务预期接收的物品。多余食物、塑料袋或错误材料可能妨碍回收。准备方式以接收服务为准，并非处处一样。"
          }
        },
        {
          "type": "bullet-list",
          "items": [
            {
              "en": "Empty accepted containers; rinse if needed.",
              "zh": "倒空可接受的容器，必要时冲洗。"
            },
            {
              "en": "Keep mixed-recycling items loose where the service requires it.",
              "zh": "服务要求散放时，不将混合回收物装袋。"
            },
            {
              "en": "Keep paper/cardboard clean and dry; tissues are different.",
              "zh": "纸与纸板保持干净、干燥；纸巾需区别处理。"
            },
            {
              "en": "Remove packaging and fruit stickers from FOGO scraps.",
              "zh": "从 FOGO 食物残余中去掉包装和水果贴纸。"
            }
          ]
        },
        {
          "type": "paragraph",
          "text": {
            "en": "Example: a used yogurt tub and a banana peel are not one waste item. The remaining food needs its accepted organics route; the empty tub needs its own material and collection check.",
            "zh": "例子：用过的酸奶盒与香蕉皮不是同一种废弃物。剩余食物应核对合适的有机物收集方式；空盒需另外核对材质和收集要求。"
          }
        },
        {
          "type": "reflection",
          "title": {
            "en": "Try it in your kitchen",
            "zh": "在你的厨房试一试"
          },
          "text": {
            "en": "Find one preparation step you can make easier with a small kitchen routine.",
            "zh": "找出一个可以通过厨房小习惯更容易完成的准备步骤。"
          }
        },
        {
          "type": "source",
          "sourceRefs": [
            "vic-sorting",
            "vic-fogo",
            "vic-glass"
          ]
        }
      ]
    },
    {
      "activityCode": "intermediate-local-guide",
      "contentVersion": "learning-room-v1",
      "stageCode": "intermediate",
      "type": "lesson",
      "title": {
        "en": "Find the right collection",
        "zh": "找到正确收集方式"
      },
      "objective": {
        "en": "Verify a current collection service for a specific item.",
        "zh": "为具体物品核实有效的收集服务。"
      },
      "durationEstimate": {
        "minutes": 3,
        "includesReflection": true,
        "basis": {
          "en": "Estimated lesson and activity time; no timer.",
          "zh": "课程与活动预计时间；没有倒计时。"
        }
      },
      "mediaAssetKey": "packaging-recycling-cover",
      "sourceRefs": [
        "vic-sorting",
        "vic-glass",
        "cds-vic"
      ],
      "relatedActivityCodes": [],
      "nextActivityCode": null,
      "completionKind": "explicit-confirmation",
      "body": [
        {
          "type": "paragraph",
          "text": {
            "en": "Victoria's guide is a starting point, not proof that your home has every service. Check the council or private waste provider for the address. Service availability, glass separation and lid instructions can differ.",
            "zh": "Victoria 指引是起点，不能证明你的住所拥有所有服务。应按地址查看 council 或私人垃圾服务商。服务是否提供、玻璃是否分收以及盖子要求都可能不同。"
          }
        },
        {
          "type": "paragraph",
          "text": {
            "en": "Soft-plastic collections can change. Confirm a service is active and accepts the exact item before using it. A photograph, an old post or a recycling triangle is not enough.",
            "zh": "软塑料收集安排会变化。使用之前确认服务正在运行，并接受该具体物品。照片、旧帖或回收三角符号都不足以保证。"
          }
        },
        {
          "type": "paragraph",
          "text": {
            "en": "CDS Vic is a separate option for eligible drink containers. Use its official eligibility check and current refund-point finder. Ordinary jars and other containers do not become eligible simply because they are glass or metal.",
            "zh": "CDS Vic 是符合条件饮料容器的另一种选择。应使用官方资格查询与有效退费点地图。普通罐子或其他容器不会仅因为是玻璃或金属就自动符合条件。"
          }
        },
        {
          "type": "reflection",
          "title": {
            "en": "Try it in your kitchen",
            "zh": "在你的厨房试一试"
          },
          "text": {
            "en": "Find the provider serving your home. Write down one item rule you had to look up rather than guess.",
            "zh": "找到服务你住所的提供方，记下一项你需要查而非猜的物品规则。"
          }
        },
        {
          "type": "source",
          "sourceRefs": [
            "vic-sorting",
            "vic-glass",
            "cds-vic"
          ]
        }
      ]
    },
    {
      "activityCode": "advanced-plan-first",
      "contentVersion": "learning-room-v1",
      "stageCode": "advanced",
      "type": "lesson",
      "title": {
        "en": "Use what you have",
        "zh": "先用已有食物"
      },
      "objective": {
        "en": "Build one meal and shopping list around existing food.",
        "zh": "围绕已有食物安排一餐和购物清单。"
      },
      "durationEstimate": {
        "minutes": 3,
        "includesReflection": true,
        "basis": {
          "en": "Estimated lesson and activity time; no timer.",
          "zh": "课程与活动预计时间；没有倒计时。"
        }
      },
      "mediaAssetKey": "preventing-waste-cover",
      "sourceRefs": [
        "vic-planning",
        "ozharvest-2025",
        "vic-storage"
      ],
      "relatedActivityCodes": [
        "advanced-storage"
      ],
      "nextActivityCode": "advanced-storage",
      "completionKind": "explicit-confirmation",
      "body": [
        {
          "type": "paragraph",
          "text": {
            "en": "Start before the shop. Look through the fridge, freezer and pantry, then choose ingredients that need using soon while still safe. A simple use-first area keeps them visible.",
            "zh": "从购物前开始。查看冰箱、冷冻室和储物柜，优先考虑仍安全且需要尽快使用的食物。简单的优先使用区可以让它们更可见。"
          }
        },
        {
          "type": "paragraph",
          "text": {
            "en": "Plan for the people who will actually eat. Link meals that share ingredients, and add only missing items to the list. A bulk bargain is not useful if it exceeds what you can use.",
            "zh": "按实际就餐人数计划。安排能共用食材的餐食，只把缺少的物品加到清单。如果买得超过能使用的量，大包装优惠也未必有用。"
          }
        },
        {
          "type": "paragraph",
          "text": {
            "en": "Example: you have carrots and half a tub of an ingredient. Plan a meal around them before choosing a recipe that requires a new shop. When plans change, review perishables again and make a safe storage plan.",
            "zh": "例子：已有胡萝卜和半盒食材时，先围绕它们计划一餐，再考虑需要重新购物的菜谱。安排改变后，再查看易腐食物并制定安全储存计划。"
          }
        },
        {
          "type": "reflection",
          "title": {
            "en": "Try it in your kitchen",
            "zh": "在你的厨房试一试"
          },
          "text": {
            "en": "Plan one meal using what you already have. List only what is missing, and check portions.",
            "zh": "用已有食物计划一餐，只列出缺少的物品，并核对份量。"
          }
        },
        {
          "type": "source",
          "sourceRefs": [
            "vic-planning",
            "ozharvest-2025",
            "vic-storage"
          ]
        }
      ]
    },
    {
      "activityCode": "advanced-storage",
      "contentVersion": "learning-room-v1",
      "stageCode": "advanced",
      "type": "lesson",
      "title": {
        "en": "Store with care",
        "zh": "合理储存"
      },
      "objective": {
        "en": "Use date labels and storage instructions safely.",
        "zh": "安全理解日期标签与储存说明。"
      },
      "durationEstimate": {
        "minutes": 4,
        "includesReflection": true,
        "basis": {
          "en": "Estimated lesson and activity time; no timer.",
          "zh": "课程与活动预计时间；没有倒计时。"
        }
      },
      "mediaAssetKey": "preventing-waste-cover",
      "sourceRefs": [
        "fsanz-dates",
        "fsanz-safety",
        "vic-storage"
      ],
      "relatedActivityCodes": [
        "advanced-climate"
      ],
      "nextActivityCode": "advanced-climate",
      "completionKind": "explicit-confirmation",
      "body": [
        {
          "type": "paragraph",
          "text": {
            "en": "Use-by is a safety limit: do not eat food after that date. Best-before mainly concerns quality. It is not a promise that any food is safe regardless of storage or condition.",
            "zh": "Use-by 是安全期限：过期后不要食用。Best-before 主要涉及品质，并不保证任何储存方式、任何状态下的食物都安全。"
          }
        },
        {
          "type": "paragraph",
          "text": {
            "en": "Follow the product's storage and preparation instructions. Keep perishable food refrigerated at 5°C or colder. Thaw frozen perishable food in the fridge or with a microwave rather than at room temperature.",
            "zh": "遵循产品的储存和准备说明。易腐食物应冷藏在 5°C 或更低温度；冷冻易腐食物应在冰箱或用微波炉解冻，不采用室温解冻。"
          }
        },
        {
          "type": "paragraph",
          "text": {
            "en": "Label and date freezer portions so they are identifiable. Visibility helps you remember food, but must not replace safe cold storage. Do not invent a longer use-by date or rely only on a normal smell.",
            "zh": "标注冷冻份量的名称和日期，方便辨认。让食物可见有助于记得使用，但不能替代安全冷藏。不要自行延长 use-by 日期，也不要只凭气味正常作判断。"
          }
        },
        {
          "type": "reflection",
          "title": {
            "en": "Try it in your kitchen",
            "zh": "在你的厨房试一试"
          },
          "text": {
            "en": "Read one food label. Identify the date type and storage instructions, and decide a safe plan before the relevant limit.",
            "zh": "阅读一个食品标签，辨认日期类型和储存要求，在相应期限前安排安全使用。"
          }
        },
        {
          "type": "source",
          "sourceRefs": [
            "fsanz-dates",
            "fsanz-safety",
            "vic-storage"
          ]
        }
      ]
    },
    {
      "activityCode": "advanced-climate",
      "contentVersion": "learning-room-v1",
      "stageCode": "advanced",
      "type": "lesson",
      "title": {
        "en": "Waste & climate action",
        "zh": "浪费与气候行动"
      },
      "objective": {
        "en": "Connect waste prevention to evidence and SDG 13.3.",
        "zh": "将减废与证据及 SDG 13.3 联系起来。"
      },
      "durationEstimate": {
        "minutes": 4,
        "includesReflection": true,
        "basis": {
          "en": "Estimated lesson and activity time; no timer.",
          "zh": "课程与活动预计时间；没有倒计时。"
        }
      },
      "mediaAssetKey": "waste-climate-cover",
      "sourceRefs": [
        "unfccc-2024",
        "unep-index-2024",
        "sdg13",
        "vic-fogo"
      ],
      "relatedActivityCodes": [],
      "nextActivityCode": null,
      "completionKind": "explicit-confirmation",
      "body": [
        {
          "type": "paragraph",
          "text": {
            "en": "Food uses land, water and energy before it is eaten. Preventing edible waste helps avoid wasting those inputs. Suitable organics collection handles unavoidable scraps; it cannot undo the resources already used.",
            "zh": "食物在食用前就需要土地、水和能源。避免可食用食物浪费也关注这些投入。合适的有机物收集可以处理无法避免的残余，却不能撤销已经投入的资源。"
          }
        },
        {
          "type": "paragraph",
          "text": {
            "en": "Read climate data with its scope. UNFCCC's 2024 article links food loss and waste to 8–10% of annual global greenhouse gas emissions. This includes both loss and waste, globally; it is not a percentage saved by this learner.",
            "zh": "阅读气候数据时保留范围。UNFCCC 2024 年文章将食物损失和浪费与全球年度温室气体排放的 8–10% 联系起来。它同时涵盖损失与浪费、范围为全球，并非本学习者节省的比例。"
          }
        },
        {
          "type": "paragraph",
          "text": {
            "en": "SDG 13.3 includes climate education and awareness. These lessons and reflection support that educational direction. Quiz results measure learning performance, not national curriculum indicators or personal carbon savings.",
            "zh": "SDG 13.3 包含气候教育与意识提升。课程和反思符合这一教育方向。测验成绩反映学习表现，不测量国家课程指标或个人减排量。"
          }
        },
        {
          "type": "reflection",
          "title": {
            "en": "Try it in your kitchen",
            "zh": "在你的厨房试一试"
          },
          "text": {
            "en": "Choose one prevention habit for this week. Describe the action you will take without claiming a measured emissions saving.",
            "zh": "为本周选一个预防浪费的习惯，说明要做的行动，不把它写成已经测量的减排量。"
          }
        },
        {
          "type": "source",
          "sourceRefs": [
            "unfccc-2024",
            "unep-index-2024",
            "sdg13",
            "vic-fogo"
          ]
        }
      ]
    }
  ],
  "resources": [
    {
      "resourceCode": "waste-climate-sdg13",
      "contentVersion": "learning-room-v1",
      "category": "data",
      "title": {
        "en": "Less waste. More climate action.",
        "zh": "减少浪费，参与气候行动。"
      },
      "summary": {
        "en": "Understand food waste's climate connection and the scope of global estimates.",
        "zh": "理解食物浪费的气候联系与全球估计的范围。"
      },
      "whyItMatters": {
        "en": "A climate fact becomes useful when you know what it measures.",
        "zh": "知道事实测量了什么，才更容易用它理解行动。"
      },
      "publisher": "UNFCCC",
      "sourceUrl": "https://unfccc.int/news/food-loss-and-waste-account-for-8-10-of-annual-global-greenhouse-gas-emissions-cost-usd-1-trillion",
      "publishedAt": "2024-09-30",
      "reviewedAt": "2026-10-05",
      "regionCode": "global",
      "relatedCourseCodes": [
        "waste-basics",
        "preventing-waste"
      ],
      "topicCodes": [
        "waste-climate"
      ],
      "coverAssetKey": "waste-climate-cover",
      "summaryKind": "kitchmemo-editorial-summary",
      "body": [
        {
          "type": "fact",
          "value": {
            "en": "8–10%",
            "zh": "8–10%"
          },
          "text": {
            "en": "of global greenhouse gas emissions are linked to food loss and waste.",
            "zh": "全球温室气体排放与食物损失和浪费有关的比例。"
          },
          "scope": {
            "en": "Annual global emissions; food loss and food waste combined. Cited by UNFCCC on 30 September 2024.",
            "zh": "全球年度排放；同时涵盖食物损失和食物浪费。UNFCCC 于 2024 年 9 月 30 日引用。"
          },
          "sourceRefs": [
            "unfccc-2024"
          ]
        },
        {
          "type": "paragraph",
          "text": {
            "en": "Producing food uses energy. Wasting it wastes those resources too.",
            "zh": "生产食物需要能源。浪费食物，也浪费了这些资源。"
          }
        },
        {
          "type": "sdg-callout",
          "goal": 13,
          "target": "13.3",
          "assetKey": "sdg-13-climate-action",
          "title": {
            "en": "SDG 13.3",
            "zh": "SDG 13.3"
          },
          "text": {
            "en": "Learn. Understand. Take action.",
            "zh": "学习、理解、行动。"
          },
          "detail": {
            "en": "Climate education and awareness.",
            "zh": "气候教育与意识提升。"
          },
          "sourceRefs": [
            "sdg13"
          ],
          "attributionRequired": true
        },
        {
          "type": "reflection",
          "title": {
            "en": "One action this week",
            "zh": "本周的一项行动"
          },
          "text": {
            "en": "Plan one meal using what you already have.",
            "zh": "用家里已有的食物计划一餐。"
          }
        },
        {
          "type": "source",
          "sourceRefs": [
            "unfccc-2024"
          ]
        }
      ],
      "sourceRefs": [
        "unfccc-2024",
        "sdg13"
      ],
      "completionKind": "explicit-confirmation",
      "readerLayout": "climate-feature",
      "relatedNewsCodes": [
        "news-zero-waste-2026"
      ],
      "statistics": {
        "measurementPeriod": "Annual global estimate cited in 2024; underlying estimation period not specified in this article",
        "populationScope": {
          "en": "Global food loss and food waste",
          "zh": "全球食物损失与食物浪费"
        },
        "units": "percent of annual global GHG emissions",
        "includes": [
          "food loss",
          "food waste"
        ],
        "excludes": [
          "personal measured emissions saving"
        ],
        "methodologyNote": {
          "en": "The article cites a range, not a personal estimate or a measurement from 2026.",
          "zh": "文章引用的是范围估计，不是个人估计或 2026 年测量。"
        }
      }
    },
    {
      "resourceCode": "global-food-waste-evidence",
      "contentVersion": "learning-room-v1",
      "category": "data",
      "title": {
        "en": "Read the food waste numbers",
        "zh": "读懂食物浪费数据"
      },
      "summary": {
        "en": "Separate the data year, publication year and sectors covered.",
        "zh": "区分统计年份、发布年份与覆盖领域。"
      },
      "whyItMatters": {
        "en": "Scope prevents a global estimate being mistaken for household or personal waste.",
        "zh": "保留范围，避免把全球估计误当作家庭或个人浪费。"
      },
      "publisher": "UNEP",
      "sourceUrl": "https://www.unep.org/news-and-stories/press-release/world-squanders-over-1-billion-meals-day-un-report",
      "publishedAt": "2024-03-27",
      "reviewedAt": "2026-10-05",
      "regionCode": "global",
      "relatedCourseCodes": [
        "preventing-waste"
      ],
      "topicCodes": [
        "waste-climate"
      ],
      "coverAssetKey": "waste-climate-cover",
      "summaryKind": "kitchmemo-editorial-summary",
      "body": [
        {
          "type": "fact",
          "value": {
            "en": "1.05 billion tonnes",
            "zh": "10.5 亿吨"
          },
          "text": {
            "en": "Estimated food waste at consumer levels in 2022.",
            "zh": "2022 年消费端食物废弃物估计量。"
          },
          "scope": {
            "en": "Retail, food service and households, including inedible parts; report released in 2024.",
            "zh": "涵盖零售、餐饮服务和家庭，并包含不可食用部分；报告于 2024 年发布。"
          },
          "sourceRefs": [
            "unep-index-2024"
          ]
        },
        {
          "type": "paragraph",
          "text": {
            "en": "The observation year is 2022. The report date is 2024. Neither makes the estimate a reading of your kitchen today.",
            "zh": "统计年份是 2022 年，报告年份是 2024 年；它们都不能让这个数值变成对你今天厨房的测量。"
          }
        },
        {
          "type": "reflection",
          "title": {
            "en": "One action this week",
            "zh": "本周的一项行动"
          },
          "text": {
            "en": "When sharing a number, include its year, unit and scope.",
            "zh": "分享数据时，一起注明年份、单位和范围。"
          }
        },
        {
          "type": "source",
          "sourceRefs": [
            "unep-index-2024"
          ]
        }
      ],
      "sourceRefs": [
        "unep-index-2024"
      ],
      "completionKind": "explicit-confirmation",
      "readerLayout": "standard",
      "statistics": {
        "measurementPeriod": "2022",
        "populationScope": {
          "en": "Global retail, food service and households",
          "zh": "全球零售、餐饮服务与家庭"
        },
        "units": "tonnes",
        "includes": [
          "inedible parts",
          "edible food waste"
        ],
        "excludes": [
          "upstream pre-retail food loss"
        ],
        "methodologyNote": {
          "en": "UNEP Food Waste Index Report 2024 estimate, not household waste alone.",
          "zh": "UNEP Food Waste Index Report 2024 估计，不只涵盖家庭。"
        }
      }
    },
    {
      "resourceCode": "local-sorting-guide",
      "contentVersion": "learning-room-v1",
      "category": "guide",
      "title": {
        "en": "Check your collection first",
        "zh": "先核对收集服务"
      },
      "summary": {
        "en": "Use Victoria's guide as a starting point, then verify your provider.",
        "zh": "从 Victoria 指引开始，再核对你的服务提供方。"
      },
      "whyItMatters": {
        "en": "The same material may have different local collection instructions.",
        "zh": "相同材料在不同地区可能有不同收集要求。"
      },
      "publisher": "Victoria Environment (DEECA)",
      "sourceUrl": "https://www.environment.vic.gov.au/household-waste-recycling/sort-waste-recycling",
      "publishedAt": null,
      "reviewedAt": "2026-10-05",
      "regionCode": "AU-VIC",
      "relatedCourseCodes": [
        "waste-basics",
        "packaging-recycling"
      ],
      "topicCodes": [
        "recycling"
      ],
      "coverAssetKey": "packaging-recycling-cover",
      "summaryKind": "kitchmemo-editorial-summary",
      "body": [
        {
          "type": "paragraph",
          "text": {
            "en": "Find the service for your address. Councils and private providers can differ, including separate glass or food-organics services.",
            "zh": "找到服务你住所的提供方。Council 与私人服务商可能不同，包括单独玻璃或厨余收集。"
          }
        },
        {
          "type": "paragraph",
          "text": {
            "en": "Do not infer a local rule from bin colour or a material symbol. If a route is unclear, check the specific item before putting it in recycling.",
            "zh": "不要根据桶色或材料符号推断当地规则。处理方式不明时，先查具体物品再投回收。"
          }
        },
        {
          "type": "reflection",
          "title": {
            "en": "One action this week",
            "zh": "本周的一项行动"
          },
          "text": {
            "en": "Look up one uncertain package using your current council or provider guide.",
            "zh": "用当前 council 或服务商指引查询一件不确定的包装。"
          }
        },
        {
          "type": "source",
          "sourceRefs": [
            "vic-sorting"
          ]
        }
      ],
      "sourceRefs": [
        "vic-sorting"
      ],
      "completionKind": "explicit-confirmation",
      "readerLayout": "standard"
    },
    {
      "resourceCode": "materials-and-components",
      "contentVersion": "learning-room-v1",
      "category": "guide",
      "title": {
        "en": "Read every packaging part",
        "zh": "阅读每个包装部件"
      },
      "summary": {
        "en": "A box, wrap and lid can have different instructions.",
        "zh": "盒、薄膜与盖子可能各有处理说明。"
      },
      "whyItMatters": {
        "en": "Following component instructions helps avoid contamination.",
        "zh": "按部件说明处理，有助于减少污染。"
      },
      "publisher": "Australian Government DCCEEW",
      "sourceUrl": "https://www.dcceew.gov.au/environment/protection/waste/packaging/australasian-recycling-label",
      "publishedAt": null,
      "reviewedAt": "2026-10-05",
      "regionCode": "AU",
      "relatedCourseCodes": [
        "waste-basics",
        "packaging-recycling"
      ],
      "topicCodes": [
        "recycling"
      ],
      "coverAssetKey": "packaging-recycling-cover",
      "summaryKind": "kitchmemo-editorial-summary",
      "body": [
        {
          "type": "paragraph",
          "text": {
            "en": "Match each component name to its label. A conditional instruction matters as much as the recycling symbol.",
            "zh": "将每个部件名称与对应标签匹配。有条件说明与回收符号一样重要。"
          }
        },
        {
          "type": "paragraph",
          "text": {
            "en": "If you cannot confirm an item's acceptance, check rather than adding an uncertain item to recycling.",
            "zh": "不能确认是否接受时，应先查，不把不确定的物品加入回收。"
          }
        },
        {
          "type": "reflection",
          "title": {
            "en": "One action this week",
            "zh": "本周的一项行动"
          },
          "text": {
            "en": "Find the instruction for both the container and its lid.",
            "zh": "找出容器和盖子分别对应的说明。"
          }
        },
        {
          "type": "source",
          "sourceRefs": [
            "arl"
          ]
        }
      ],
      "sourceRefs": [
        "arl"
      ],
      "completionKind": "explicit-confirmation",
      "readerLayout": "standard"
    },
    {
      "resourceCode": "plan-before-shopping",
      "contentVersion": "learning-room-v1",
      "category": "guide",
      "title": {
        "en": "Build a use-first meal",
        "zh": "计划优先使用的一餐"
      },
      "summary": {
        "en": "Check existing food and buy only the missing ingredients.",
        "zh": "查看已有食物，只购买缺少的食材。"
      },
      "whyItMatters": {
        "en": "Small planning choices address waste before it happens.",
        "zh": "小的计划选择，可以在浪费发生前发挥作用。"
      },
      "publisher": "Victoria Environment (DEECA)",
      "sourceUrl": "https://www.environment.vic.gov.au/household-waste-recycling/reduce-waste/food-waste/planning-shopping",
      "publishedAt": null,
      "reviewedAt": "2026-10-05",
      "regionCode": "AU-VIC",
      "relatedCourseCodes": [
        "preventing-waste"
      ],
      "topicCodes": [
        "preventing-waste"
      ],
      "coverAssetKey": "preventing-waste-cover",
      "summaryKind": "kitchmemo-editorial-summary",
      "body": [
        {
          "type": "paragraph",
          "text": {
            "en": "Check fridge, freezer and pantry. Make a visible use-first area for food that needs attention while still safe.",
            "zh": "查看冰箱、冷冻室和储物柜。为仍安全、需要优先使用的食物安排可见区域。"
          }
        },
        {
          "type": "paragraph",
          "text": {
            "en": "Choose portions for the people who will eat, and meals that can share ingredients. Update the plan when your week changes.",
            "zh": "按实际人数安排份量，并选择能共用食材的餐食。每周安排变化时更新计划。"
          }
        },
        {
          "type": "reflection",
          "title": {
            "en": "One action this week",
            "zh": "本周的一项行动"
          },
          "text": {
            "en": "Write a short shopping list from one meal built around existing food.",
            "zh": "从一餐以已有食物为主的计划，写出简短购物清单。"
          }
        },
        {
          "type": "source",
          "sourceRefs": [
            "vic-planning"
          ]
        }
      ],
      "sourceRefs": [
        "vic-planning"
      ],
      "completionKind": "explicit-confirmation",
      "readerLayout": "standard"
    },
    {
      "resourceCode": "date-labels-and-storage",
      "contentVersion": "learning-room-v1",
      "category": "guide",
      "title": {
        "en": "Safety first, waste less",
        "zh": "安全优先，减少浪费"
      },
      "summary": {
        "en": "Understand use-by, best-before and required storage.",
        "zh": "理解 use-by、best-before 与必要储存条件。"
      },
      "whyItMatters": {
        "en": "Reducing waste must respect food safety.",
        "zh": "减少浪费必须尊重食品安全。"
      },
      "publisher": "Food Standards Australia New Zealand",
      "sourceUrl": "https://www.foodstandards.gov.au/consumer/labelling/dates",
      "publishedAt": null,
      "reviewedAt": "2026-10-05",
      "regionCode": "AU",
      "relatedCourseCodes": [
        "preventing-waste"
      ],
      "topicCodes": [
        "preventing-waste"
      ],
      "coverAssetKey": "preventing-waste-cover",
      "summaryKind": "kitchmemo-editorial-summary",
      "body": [
        {
          "type": "paragraph",
          "text": {
            "en": "Do not eat food past its use-by date. Best-before mainly concerns quality, while condition and storage remain relevant.",
            "zh": "不要食用超过 use-by 日期的食物。Best-before 主要涉及品质，食物状态与储存条件仍需考虑。"
          }
        },
        {
          "type": "paragraph",
          "text": {
            "en": "Follow the label's storage and preparation directions. A date alone cannot account for inappropriate storage.",
            "zh": "遵循标签的储存和准备说明，日期本身不能弥补不当储存。"
          }
        },
        {
          "type": "reflection",
          "title": {
            "en": "One action this week",
            "zh": "本周的一项行动"
          },
          "text": {
            "en": "Check a label's date type and storage directions before making a use-first plan.",
            "zh": "安排优先使用计划前，查看标签的日期类型与储存要求。"
          }
        },
        {
          "type": "source",
          "sourceRefs": [
            "fsanz-dates"
          ]
        }
      ],
      "sourceRefs": [
        "fsanz-dates"
      ],
      "completionKind": "explicit-confirmation",
      "readerLayout": "standard"
    },
    {
      "resourceCode": "news-zero-waste-2026",
      "contentVersion": "learning-room-v1",
      "category": "news",
      "title": {
        "en": "Zero Waste Day puts food waste in focus",
        "zh": "零废弃日聚焦食物浪费"
      },
      "summary": {
        "en": "UNEP's 30 March 2026 announcement places food waste at the centre of this year's awareness day.",
        "zh": "UNEP 2026 年 3 月 30 日公告，将食物浪费作为当年宣传日的重点。"
      },
      "whyItMatters": {
        "en": "Connect an everyday prevention habit with wider climate education.",
        "zh": "把日常预防习惯与更广泛的气候教育联系起来。"
      },
      "publisher": "UNEP",
      "sourceUrl": "https://www.unep.org/news-and-stories/press-release/food-waste-focus-world-marks-international-day-zero-waste",
      "publishedAt": "2026-03-30",
      "reviewedAt": "2026-10-05",
      "regionCode": "global",
      "relatedCourseCodes": [
        "preventing-waste"
      ],
      "topicCodes": [
        "waste-climate"
      ],
      "coverAssetKey": "waste-climate-cover",
      "summaryKind": "kitchmemo-editorial-summary",
      "body": [
        {
          "type": "paragraph",
          "text": {
            "en": "The announcement discusses food waste across homes, businesses and cities. It highlights awareness and practical prevention as part of wider environmental action.",
            "zh": "公告讨论了家庭、企业与城市层面的食物浪费，强调意识提升与实际预防在环境行动中的作用。"
          }
        },
        {
          "type": "reflection",
          "title": {
            "en": "One action this week",
            "zh": "本周的一项行动"
          },
          "text": {
            "en": "Choose a prevention habit to discuss with someone at home.",
            "zh": "选择一个预防浪费的习惯，与家里的人交流。"
          }
        },
        {
          "type": "source",
          "sourceRefs": [
            "unep-zero-waste-2026"
          ]
        }
      ],
      "sourceRefs": [
        "unep-zero-waste-2026"
      ],
      "completionKind": "explicit-confirmation",
      "readerLayout": "standard",
      "newsContext": "dated-announcement"
    },
    {
      "resourceCode": "news-cds-vic-2026",
      "contentVersion": "learning-room-v1",
      "category": "news",
      "title": {
        "en": "Victoria reports a container-return milestone",
        "zh": "Victoria 公布容器回收里程碑"
      },
      "summary": {
        "en": "On 4 April 2026, the Victorian Government reported more than 3 billion container returns through CDS Vic.",
        "zh": "2026 年 4 月 4 日，Victoria 政府报告 CDS Vic 容器累计回收超过 30 亿个。"
      },
      "whyItMatters": {
        "en": "A separate collection scheme has eligibility rules as well as public results.",
        "zh": "专门收集计划既有资格规则，也有公开成果。"
      },
      "publisher": "Premier of Victoria",
      "sourceUrl": "https://www.premier.vic.gov.au/real-savings-victorians-through-recycling",
      "publishedAt": "2026-04-04",
      "reviewedAt": "2026-10-05",
      "regionCode": "AU-VIC",
      "relatedCourseCodes": [
        "packaging-recycling"
      ],
      "topicCodes": [
        "recycling"
      ],
      "coverAssetKey": "packaging-recycling-cover",
      "summaryKind": "kitchmemo-editorial-summary",
      "body": [
        {
          "type": "paragraph",
          "text": {
            "en": "This is a government-reported cumulative milestone at the publication date. It is not this app's return count or a live total.",
            "zh": "这是政府在发布日期报告的累计里程碑，并非本 App 的回收计数或实时总量。"
          }
        },
        {
          "type": "paragraph",
          "text": {
            "en": "For a return you plan today, use CDS Vic's current eligibility and refund-point information.",
            "zh": "如果计划今天退回容器，请查看 CDS Vic 当前的资格与退费点信息。"
          }
        },
        {
          "type": "reflection",
          "title": {
            "en": "One action this week",
            "zh": "本周的一项行动"
          },
          "text": {
            "en": "Check whether one drink container is eligible before planning a return.",
            "zh": "计划退回前，核对一个饮料容器是否符合条件。"
          }
        },
        {
          "type": "source",
          "sourceRefs": [
            "vic-cds-news-2026"
          ]
        }
      ],
      "sourceRefs": [
        "vic-cds-news-2026",
        "cds-vic"
      ],
      "completionKind": "explicit-confirmation",
      "readerLayout": "standard",
      "newsContext": "dated-announcement"
    },
    {
      "resourceCode": "news-date-labels-2024",
      "contentVersion": "learning-room-v1",
      "category": "news",
      "title": {
        "en": "Why food date labels cause confusion",
        "zh": "食品日期标签为何容易混淆"
      },
      "summary": {
        "en": "In a 31 October 2024 article, FSANZ explained the difference between safety and quality date marks.",
        "zh": "FSANZ 于 2024 年 10 月 31 日的文章解释了安全与品质日期标记的区别。"
      },
      "whyItMatters": {
        "en": "This historical article gives context for the storage lesson; it is not a new rule.",
        "zh": "这篇历史文章为储存课程提供背景，不代表新规则。"
      },
      "publisher": "Food Standards Australia New Zealand",
      "sourceUrl": "https://www.foodstandards.gov.au/news/we-hear-you-lets-clear-confusion-around-food-date-labels",
      "publishedAt": "2024-10-31",
      "reviewedAt": "2026-10-05",
      "regionCode": "AU",
      "relatedCourseCodes": [
        "preventing-waste"
      ],
      "topicCodes": [
        "preventing-waste"
      ],
      "coverAssetKey": "preventing-waste-cover",
      "summaryKind": "kitchmemo-editorial-summary",
      "body": [
        {
          "type": "paragraph",
          "text": {
            "en": "The article distinguishes use-by from best-before. Read current FSANZ guidance and product storage instructions when deciding how to handle food.",
            "zh": "文章区分 use-by 和 best-before。处理食物时应结合 FSANZ 当前指引与产品储存说明。"
          }
        },
        {
          "type": "reflection",
          "title": {
            "en": "One action this week",
            "zh": "本周的一项行动"
          },
          "text": {
            "en": "Explain the two date types in your own words, without saying smell overrides use-by.",
            "zh": "用自己的话解释两类日期，但不要说气味可以推翻 use-by。"
          }
        },
        {
          "type": "source",
          "sourceRefs": [
            "fsanz-date-news-2024"
          ]
        }
      ],
      "sourceRefs": [
        "fsanz-date-news-2024",
        "fsanz-dates"
      ],
      "completionKind": "explicit-confirmation",
      "readerLayout": "standard",
      "newsContext": "historical-background"
    }
  ],
  "sources": [
    {
      "sourceCode": "vic-sorting",
      "title": "How to sort waste and recycling at home",
      "publisher": "Victoria Environment (DEECA)",
      "url": "https://www.environment.vic.gov.au/household-waste-recycling/sort-waste-recycling",
      "regionCode": "AU-VIC",
      "publishedAt": null,
      "updatedAt": "2026-09-24",
      "reviewedAt": "2026-10-05",
      "dateNote": "Publication date not stated; updatedAt is a page update where verified."
    },
    {
      "sourceCode": "vic-fogo",
      "title": "Recycling food and garden organics in Victoria",
      "publisher": "Victoria Environment (DEECA)",
      "url": "https://www.environment.vic.gov.au/household-waste-recycling/recycling-food-garden-organics",
      "regionCode": "AU-VIC",
      "publishedAt": null,
      "updatedAt": null,
      "reviewedAt": "2026-10-05",
      "dateNote": "Publication date not stated; updatedAt is a page update where verified."
    },
    {
      "sourceCode": "vic-glass",
      "title": "Recycling glass in Victoria",
      "publisher": "Victoria Environment (DEECA)",
      "url": "https://www.environment.vic.gov.au/household-waste-recycling/recycling-glass",
      "regionCode": "AU-VIC",
      "publishedAt": null,
      "updatedAt": null,
      "reviewedAt": "2026-10-05",
      "dateNote": "Publication date not stated; updatedAt is a page update where verified."
    },
    {
      "sourceCode": "arl",
      "title": "Recycling packaging",
      "publisher": "Australian Government DCCEEW",
      "url": "https://www.dcceew.gov.au/environment/protection/waste/packaging/australasian-recycling-label",
      "regionCode": "AU",
      "publishedAt": null,
      "updatedAt": "2025-10-02",
      "reviewedAt": "2026-10-05",
      "dateNote": "Publication date not stated; updatedAt is a page update where verified."
    },
    {
      "sourceCode": "cds-vic",
      "title": "Victoria's Container Deposit Scheme",
      "publisher": "CDS Vic",
      "url": "https://cdsvic.org.au/",
      "regionCode": "AU-VIC",
      "publishedAt": null,
      "updatedAt": null,
      "reviewedAt": "2026-10-05",
      "dateNote": "Publication date not stated; updatedAt is a page update where verified."
    },
    {
      "sourceCode": "vic-planning",
      "title": "Plan meals and shop to avoid food waste",
      "publisher": "Victoria Environment (DEECA)",
      "url": "https://www.environment.vic.gov.au/household-waste-recycling/reduce-waste/food-waste/planning-shopping",
      "regionCode": "AU-VIC",
      "publishedAt": null,
      "updatedAt": null,
      "reviewedAt": "2026-10-05",
      "dateNote": "Publication date not stated; updatedAt is a page update where verified."
    },
    {
      "sourceCode": "vic-storage",
      "title": "Store food properly so it lasts longer",
      "publisher": "Victoria Environment (DEECA)",
      "url": "https://www.environment.vic.gov.au/household-waste-recycling/reduce-waste/food-waste/storage",
      "regionCode": "AU-VIC",
      "publishedAt": null,
      "updatedAt": null,
      "reviewedAt": "2026-10-05",
      "dateNote": "Publication date not stated; updatedAt is a page update where verified."
    },
    {
      "sourceCode": "fsanz-dates",
      "title": "Use-by and best-before dates",
      "publisher": "Food Standards Australia New Zealand",
      "url": "https://www.foodstandards.gov.au/consumer/labelling/dates",
      "regionCode": "AU",
      "publishedAt": null,
      "updatedAt": "2025-02-25",
      "reviewedAt": "2026-10-05",
      "dateNote": "Publication date not stated; updatedAt is a page update where verified."
    },
    {
      "sourceCode": "fsanz-safety",
      "title": "Food safety basics",
      "publisher": "Food Standards Australia New Zealand",
      "url": "https://www.foodstandards.gov.au/consumer/prevention-of-foodborne-illness/food-safety-basics",
      "regionCode": "AU",
      "publishedAt": null,
      "updatedAt": "2025-07-08",
      "reviewedAt": "2026-10-05",
      "dateNote": "Publication date not stated; updatedAt is a page update where verified."
    },
    {
      "sourceCode": "vic-reuse",
      "title": "Reuse and repair",
      "publisher": "Victoria Environment (DEECA)",
      "url": "https://www.environment.vic.gov.au/household-waste-recycling/reduce-waste/reuse-repair",
      "regionCode": "AU-VIC",
      "publishedAt": null,
      "updatedAt": null,
      "reviewedAt": "2026-10-05",
      "dateNote": "Publication date not stated; updatedAt is a page update where verified."
    },
    {
      "sourceCode": "vic-single-use",
      "title": "Avoid single-use items",
      "publisher": "Victoria Environment (DEECA)",
      "url": "https://www.environment.vic.gov.au/household-waste-recycling/reduce-waste/avoid-single-use-items",
      "regionCode": "AU-VIC",
      "publishedAt": null,
      "updatedAt": null,
      "reviewedAt": "2026-10-05",
      "dateNote": "Publication date not stated; updatedAt is a page update where verified."
    },
    {
      "sourceCode": "unfccc-2024",
      "title": "Food loss and waste account for 8-10% of annual global greenhouse gas emissions",
      "publisher": "UNFCCC",
      "url": "https://unfccc.int/news/food-loss-and-waste-account-for-8-10-of-annual-global-greenhouse-gas-emissions-cost-usd-1-trillion",
      "regionCode": "global",
      "publishedAt": "2024-09-30",
      "updatedAt": null,
      "reviewedAt": "2026-10-05",
      "dateNote": null
    },
    {
      "sourceCode": "unep-index-2024",
      "title": "World squanders over 1 billion meals a day - UN report",
      "publisher": "UNEP",
      "url": "https://www.unep.org/news-and-stories/press-release/world-squanders-over-1-billion-meals-day-un-report",
      "regionCode": "global",
      "publishedAt": "2024-03-27",
      "updatedAt": null,
      "reviewedAt": "2026-10-05",
      "dateNote": null
    },
    {
      "sourceCode": "sdg13",
      "title": "Goal 13: Climate Action",
      "publisher": "United Nations DESA",
      "url": "https://sdgs.un.org/goals/goal13",
      "regionCode": "global",
      "publishedAt": null,
      "updatedAt": null,
      "reviewedAt": "2026-10-05",
      "dateNote": "Publication date not stated; updatedAt is a page update where verified."
    },
    {
      "sourceCode": "ozharvest-2025",
      "title": "Half Eaten: Australian Household Food Waste Research",
      "publisher": "OzHarvest",
      "url": "https://www.ozharvest.org/australian-household-food-waste-research/",
      "regionCode": "AU",
      "publishedAt": null,
      "updatedAt": null,
      "reviewedAt": "2026-10-05",
      "dateNote": "Publication date not stated; updatedAt is a page update where verified."
    },
    {
      "sourceCode": "unep-zero-waste-2026",
      "title": "Food waste in focus as the world marks the International Day of Zero Waste",
      "publisher": "UNEP",
      "url": "https://www.unep.org/news-and-stories/press-release/food-waste-focus-world-marks-international-day-zero-waste",
      "regionCode": "global",
      "publishedAt": "2026-03-30",
      "updatedAt": null,
      "reviewedAt": "2026-10-05",
      "dateNote": null
    },
    {
      "sourceCode": "vic-cds-news-2026",
      "title": "Real Savings For Victorians Through Recycling",
      "publisher": "Premier of Victoria",
      "url": "https://www.premier.vic.gov.au/real-savings-victorians-through-recycling",
      "regionCode": "AU-VIC",
      "publishedAt": "2026-04-04",
      "updatedAt": null,
      "reviewedAt": "2026-10-05",
      "dateNote": null
    },
    {
      "sourceCode": "fsanz-date-news-2024",
      "title": "We hear you – Let’s clear up the confusion around food date labels",
      "publisher": "Food Standards Australia New Zealand",
      "url": "https://www.foodstandards.gov.au/news/we-hear-you-lets-clear-confusion-around-food-date-labels",
      "regionCode": "AU",
      "publishedAt": "2024-10-31",
      "updatedAt": "2025-06-17",
      "reviewedAt": "2026-10-05",
      "dateNote": null
    }
  ]
} satisfies PublicLearningContent;
