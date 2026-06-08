/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collections = [
  {
    "id": "_pb_users_auth_",
    "name": "users",
    "type": "auth",
    "system": false,
    "fields": [
      {
        "system": true,
        "id": "id",
        "name": "id",
        "type": "id",
        "required": true,
        "presentable": false,
        "unique": false,
        "options": {}
      },
      {
        "system": true,
        "id": "username",
        "name": "username",
        "type": "text",
        "required": true,
        "presentable": false,
        "unique": false,
        "options": {
          "min": 3,
          "max": 150,
          "pattern": "^[a-zA-Z0-9][a-zA-Z0-9_.-]*$"
        }
      },
      {
        "system": true,
        "id": "email",
        "name": "email",
        "type": "email",
        "required": true,
        "presentable": false,
        "unique": false,
        "options": {
          "exceptEmailDomains": null,
          "onlyEmailDomains": null
        }
      },
      {
        "system": true,
        "id": "emailVisibility",
        "name": "emailVisibility",
        "type": "bool",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {}
      },
      {
        "system": true,
        "id": "verified",
        "name": "verified",
        "type": "bool",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {}
      },
      {
        "id": "users_name",
        "name": "name",
        "type": "text",
        "required": false,
        "presentable": false,
        "options": {
          "min": null,
          "max": null,
          "pattern": ""
        }
      },
      {
        "id": "users_avatar",
        "name": "avatar",
        "type": "file",
        "required": false,
        "presentable": false,
        "options": {
          "mimeTypes": [
            "image/jpeg",
            "image/png",
            "image/svg+xml",
            "image/gif",
            "image/webp"
          ],
          "thumbs": null,
          "maxSelect": 1,
          "maxSize": 5242880,
          "protected": false
        }
      },
      {
        "system": false,
        "id": "created",
        "name": "created",
        "type": "autodate",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
          "onCreate": true,
          "onUpdate": false
        }
      },
      {
        "system": false,
        "id": "updated",
        "name": "updated",
        "type": "autodate",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
          "onCreate": true,
          "onUpdate": true
        }
      }
    ],
    "indexes": [],
    "listRule": "id = @request.auth.id",
    "viewRule": "id = @request.auth.id",
    "createRule": "",
    "updateRule": "id = @request.auth.id",
    "deleteRule": "id = @request.auth.id",
    "options": {
      "allowEmailAuth": true,
      "allowOAuth2Auth": true,
      "allowUsernameAuth": true,
      "exceptEmailDomains": null,
      "manageRule": null,
      "minPasswordLength": 8,
      "onlyEmailDomains": null,
      "onlyVerified": false,
      "requireEmail": false
    }
  },
  {
    "id": "programs_coll00",
    "name": "programs",
    "type": "base",
    "system": false,
    "fields": [
      {
        "system": true,
        "id": "id",
        "name": "id",
        "type": "id",
        "required": true,
        "presentable": false,
        "unique": false,
        "options": {}
      },
      {
        "id": "prg_name_field",
        "name": "name",
        "type": "text",
        "required": true,
        "presentable": true,
        "options": {}
      },
      {
        "system": false,
        "id": "created",
        "name": "created",
        "type": "autodate",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
          "onCreate": true,
          "onUpdate": false
        }
      },
      {
        "system": false,
        "id": "updated",
        "name": "updated",
        "type": "autodate",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
          "onCreate": true,
          "onUpdate": true
        }
      }
    ],
    "indexes": [],
    "listRule": "@request.auth.id != \"\"",
    "viewRule": "@request.auth.id != \"\"",
    "createRule": "@request.auth.id != \"\"",
    "updateRule": "@request.auth.id != \"\"",
    "deleteRule": "@request.auth.id != \"\"",
    "options": {}
  },
  {
    "id": "terms_coll00000",
    "name": "terms",
    "type": "base",
    "system": false,
    "fields": [
      {
        "system": true,
        "id": "id",
        "name": "id",
        "type": "id",
        "required": true,
        "presentable": false,
        "unique": false,
        "options": {}
      },
      {
        "id": "trm_name_field",
        "name": "name",
        "type": "text",
        "required": true,
        "presentable": true,
        "options": {}
      },
      {
        "system": false,
        "id": "created",
        "name": "created",
        "type": "autodate",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
          "onCreate": true,
          "onUpdate": false
        }
      },
      {
        "system": false,
        "id": "updated",
        "name": "updated",
        "type": "autodate",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
          "onCreate": true,
          "onUpdate": true
        }
      }
    ],
    "indexes": [],
    "listRule": "@request.auth.id != \"\"",
    "viewRule": "@request.auth.id != \"\"",
    "createRule": "@request.auth.id != \"\"",
    "updateRule": "@request.auth.id != \"\"",
    "deleteRule": "@request.auth.id != \"\"",
    "options": {}
  },
  {
    "id": "courses_coll000",
    "name": "courses",
    "type": "base",
    "system": false,
    "fields": [
      {
        "system": true,
        "id": "id",
        "name": "id",
        "type": "id",
        "required": true,
        "presentable": false,
        "unique": false,
        "options": {}
      },
      {
        "id": "crs_prog_id_fld",
        "name": "program_id",
        "type": "relation",
        "required": true,
        "options": {
          "collectionId": "programs_coll00",
          "cascadeDelete": true,
          "maxSelect": 1
        }
      },
      {
        "id": "crs_term_id_fld",
        "name": "term_id",
        "type": "relation",
        "required": true,
        "options": {
          "collectionId": "terms_coll00000",
          "cascadeDelete": true,
          "maxSelect": 1
        }
      },
      {
        "id": "crs_code_field",
        "name": "code",
        "type": "text",
        "required": true,
        "options": {}
      },
      {
        "id": "crs_name_field",
        "name": "name",
        "type": "text",
        "required": true,
        "presentable": true,
        "options": {}
      },
      {
        "id": "crs_akts_field",
        "name": "akts",
        "type": "number",
        "options": {}
      },
      {
        "id": "crs_instructor",
        "name": "instructor",
        "type": "text",
        "options": {}
      },
      {
        "id": "crs_grade_level",
        "name": "grade_level",
        "type": "text",
        "options": {}
      },
      {
        "id": "crs_pct_vize_f",
        "name": "pct_vize",
        "type": "number",
        "options": {}
      },
      {
        "id": "crs_pct_odev_f",
        "name": "pct_odev",
        "type": "number",
        "options": {}
      },
      {
        "id": "crs_pct_uyg_fl",
        "name": "pct_uygulama",
        "type": "number",
        "options": {}
      },
      {
        "id": "crs_pct_finalf",
        "name": "pct_final",
        "type": "number",
        "options": {}
      },
      {
        "id": "crs_pct_but_fl",
        "name": "pct_but",
        "type": "number",
        "options": {}
      },
      {
        "system": false,
        "id": "created",
        "name": "created",
        "type": "autodate",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
          "onCreate": true,
          "onUpdate": false
        }
      },
      {
        "system": false,
        "id": "updated",
        "name": "updated",
        "type": "autodate",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
          "onCreate": true,
          "onUpdate": true
        }
      }
    ],
    "indexes": [
      "CREATE INDEX idx_courses_program_term ON courses (program_id, term_id)"
    ],
    "listRule": "@request.auth.id != \"\"",
    "viewRule": "@request.auth.id != \"\"",
    "createRule": "@request.auth.id != \"\"",
    "updateRule": "@request.auth.id != \"\"",
    "deleteRule": "@request.auth.id != \"\"",
    "options": {}
  },
  {
    "id": "prog_outcomes_c",
    "name": "program_outcomes",
    "type": "base",
    "system": false,
    "fields": [
      {
        "system": true,
        "id": "id",
        "name": "id",
        "type": "id",
        "required": true,
        "presentable": false,
        "unique": false,
        "options": {}
      },
      {
        "id": "po_prog_id_fld",
        "name": "program_id",
        "type": "relation",
        "required": true,
        "options": {
          "collectionId": "programs_coll00",
          "cascadeDelete": true,
          "maxSelect": 1
        }
      },
      {
        "id": "po_code_field",
        "name": "code",
        "type": "text",
        "required": true,
        "options": {}
      },
      {
        "id": "po_desc_field",
        "name": "description",
        "type": "text",
        "options": {}
      },
      {
        "system": false,
        "id": "created",
        "name": "created",
        "type": "autodate",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
          "onCreate": true,
          "onUpdate": false
        }
      },
      {
        "system": false,
        "id": "updated",
        "name": "updated",
        "type": "autodate",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
          "onCreate": true,
          "onUpdate": true
        }
      }
    ],
    "indexes": [],
    "listRule": "@request.auth.id != \"\"",
    "viewRule": "@request.auth.id != \"\"",
    "createRule": "@request.auth.id != \"\"",
    "updateRule": "@request.auth.id != \"\"",
    "deleteRule": "@request.auth.id != \"\"",
    "options": {}
  },
  {
    "id": "cour_outcomes_c",
    "name": "course_outcomes",
    "type": "base",
    "system": false,
    "fields": [
      {
        "system": true,
        "id": "id",
        "name": "id",
        "type": "id",
        "required": true,
        "presentable": false,
        "unique": false,
        "options": {}
      },
      {
        "id": "co_course_id_f",
        "name": "course_id",
        "type": "relation",
        "required": true,
        "options": {
          "collectionId": "courses_coll000",
          "cascadeDelete": true,
          "maxSelect": 1
        }
      },
      {
        "id": "co_code_field",
        "name": "code",
        "type": "text",
        "required": true,
        "options": {}
      },
      {
        "id": "co_desc_field",
        "name": "description",
        "type": "text",
        "options": {}
      },
      {
        "system": false,
        "id": "created",
        "name": "created",
        "type": "autodate",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
          "onCreate": true,
          "onUpdate": false
        }
      },
      {
        "system": false,
        "id": "updated",
        "name": "updated",
        "type": "autodate",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
          "onCreate": true,
          "onUpdate": true
        }
      }
    ],
    "indexes": [],
    "listRule": "@request.auth.id != \"\"",
    "viewRule": "@request.auth.id != \"\"",
    "createRule": "@request.auth.id != \"\"",
    "updateRule": "@request.auth.id != \"\"",
    "deleteRule": "@request.auth.id != \"\"",
    "options": {}
  },
  {
    "id": "matrix_coll0000",
    "name": "matrix",
    "type": "base",
    "system": false,
    "fields": [
      {
        "system": true,
        "id": "id",
        "name": "id",
        "type": "id",
        "required": true,
        "presentable": false,
        "unique": false,
        "options": {}
      },
      {
        "id": "mat_course_id_",
        "name": "course_id",
        "type": "relation",
        "required": true,
        "options": {
          "collectionId": "courses_coll000",
          "cascadeDelete": true,
          "maxSelect": 1
        }
      },
      {
        "id": "mat_dc_code_fl",
        "name": "dc_code",
        "type": "text",
        "required": true,
        "options": {}
      },
      {
        "id": "mat_pc_code_fl",
        "name": "pc_code",
        "type": "text",
        "required": true,
        "options": {}
      },
      {
        "id": "mat_value_field",
        "name": "value",
        "type": "number",
        "options": {}
      },
      {
        "system": false,
        "id": "created",
        "name": "created",
        "type": "autodate",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
          "onCreate": true,
          "onUpdate": false
        }
      },
      {
        "system": false,
        "id": "updated",
        "name": "updated",
        "type": "autodate",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
          "onCreate": true,
          "onUpdate": true
        }
      }
    ],
    "indexes": [
      "CREATE UNIQUE INDEX idx_matrix_course_dc_pc ON matrix (course_id, dc_code, pc_code)"
    ],
    "listRule": "@request.auth.id != \"\"",
    "viewRule": "@request.auth.id != \"\"",
    "createRule": "@request.auth.id != \"\"",
    "updateRule": "@request.auth.id != \"\"",
    "deleteRule": "@request.auth.id != \"\"",
    "options": {}
  },
  {
    "id": "questions_coll",
    "name": "questions",
    "type": "base",
    "system": false,
    "fields": [
      {
        "system": true,
        "id": "id",
        "name": "id",
        "type": "id",
        "required": true,
        "presentable": false,
        "unique": false,
        "options": {}
      },
      {
        "id": "q_course_id_fl",
        "name": "course_id",
        "type": "relation",
        "required": true,
        "options": {
          "collectionId": "courses_coll000",
          "cascadeDelete": true,
          "maxSelect": 1
        }
      },
      {
        "id": "q_code_field",
        "name": "code",
        "type": "text",
        "required": true,
        "options": {}
      },
      {
        "id": "q_desc_field",
        "name": "description",
        "type": "text",
        "options": {}
      },
      {
        "id": "q_exam_type_fl",
        "name": "exam_type",
        "type": "text",
        "required": true,
        "options": {}
      },
      {
        "id": "q_q_type_field",
        "name": "question_type",
        "type": "text",
        "required": true,
        "options": {}
      },
      {
        "id": "q_dc_code_field",
        "name": "dc_code",
        "type": "text",
        "options": {}
      },
      {
        "id": "q_max_score_fl",
        "name": "max_score",
        "type": "number",
        "options": {}
      },
      {
        "id": "q_answer_key_f",
        "name": "answer_key",
        "type": "text",
        "options": {}
      },
      {
        "system": false,
        "id": "created",
        "name": "created",
        "type": "autodate",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
          "onCreate": true,
          "onUpdate": false
        }
      },
      {
        "system": false,
        "id": "updated",
        "name": "updated",
        "type": "autodate",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
          "onCreate": true,
          "onUpdate": true
        }
      }
    ],
    "indexes": [],
    "listRule": "@request.auth.id != \"\"",
    "viewRule": "@request.auth.id != \"\"",
    "createRule": "@request.auth.id != \"\"",
    "updateRule": "@request.auth.id != \"\"",
    "deleteRule": "@request.auth.id != \"\"",
    "options": {}
  },
  {
    "id": "students_coll0",
    "name": "students",
    "type": "base",
    "system": false,
    "fields": [
      {
        "system": true,
        "id": "id",
        "name": "id",
        "type": "id",
        "required": true,
        "presentable": false,
        "unique": false,
        "options": {}
      },
      {
        "id": "s_course_id_fl",
        "name": "course_id",
        "type": "relation",
        "required": true,
        "options": {
          "collectionId": "courses_coll000",
          "cascadeDelete": true,
          "maxSelect": 1
        }
      },
      {
        "id": "s_student_no_f",
        "name": "student_no",
        "type": "text",
        "required": true,
        "options": {}
      },
      {
        "id": "s_full_name_fl",
        "name": "full_name",
        "type": "text",
        "required": true,
        "options": {}
      },
      {
        "system": false,
        "id": "created",
        "name": "created",
        "type": "autodate",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
          "onCreate": true,
          "onUpdate": false
        }
      },
      {
        "system": false,
        "id": "updated",
        "name": "updated",
        "type": "autodate",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
          "onCreate": true,
          "onUpdate": true
        }
      }
    ],
    "indexes": [
      "CREATE UNIQUE INDEX idx_student_course_no ON students (course_id, student_no)"
    ],
    "listRule": "@request.auth.id != \"\"",
    "viewRule": "@request.auth.id != \"\"",
    "createRule": "@request.auth.id != \"\"",
    "updateRule": "@request.auth.id != \"\"",
    "deleteRule": "@request.auth.id != \"\"",
    "options": {}
  },
  {
    "id": "stud_grades_co",
    "name": "student_grades",
    "type": "base",
    "system": false,
    "fields": [
      {
        "system": true,
        "id": "id",
        "name": "id",
        "type": "id",
        "required": true,
        "presentable": false,
        "unique": false,
        "options": {}
      },
      {
        "id": "g_student_id_f",
        "name": "student_id",
        "type": "relation",
        "required": true,
        "options": {
          "collectionId": "students_coll0",
          "cascadeDelete": true,
          "maxSelect": 1
        }
      },
      {
        "id": "g_question_id_",
        "name": "question_id",
        "type": "relation",
        "required": true,
        "options": {
          "collectionId": "questions_coll",
          "cascadeDelete": true,
          "maxSelect": 1
        }
      },
      {
        "id": "g_score_field",
        "name": "score",
        "type": "number",
        "options": {}
      },
      {
        "system": false,
        "id": "created",
        "name": "created",
        "type": "autodate",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
          "onCreate": true,
          "onUpdate": false
        }
      },
      {
        "system": false,
        "id": "updated",
        "name": "updated",
        "type": "autodate",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
          "onCreate": true,
          "onUpdate": true
        }
      }
    ],
    "indexes": [
      "CREATE UNIQUE INDEX idx_grade_student_question ON student_grades (student_id, question_id)"
    ],
    "listRule": "@request.auth.id != \"\"",
    "viewRule": "@request.auth.id != \"\"",
    "createRule": "@request.auth.id != \"\"",
    "updateRule": "@request.auth.id != \"\"",
    "deleteRule": "@request.auth.id != \"\"",
    "options": {}
  }
];

  return importCollections(collections, false);
}, (app) => {
  // Down migration
  return null;
});
