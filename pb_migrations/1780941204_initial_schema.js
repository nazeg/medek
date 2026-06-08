/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // Extend users auth collection
  const users = app.findCollectionByNameOrId("_pb_users_auth_")
  if (users) {
    let changed = false
    if (!users.fields.getByName("name")) {
      users.fields.add(new TextField({ name: "name" }))
      changed = true
    }
    if (!users.fields.getByName("avatar")) {
      users.fields.add(new FileField({
        name: "avatar",
        mimeTypes: ["image/jpeg", "image/png", "image/svg+xml", "image/gif", "image/webp"],
        maxSelect: 1,
        maxSize: 5242880,
      }))
      changed = true
    }
    if (changed) app.save(users)
  }

  // Programs
  let collection = new Collection({ type: "base", name: "programs" })
  collection.fields.add(new TextField({ name: "name", required: true, presentable: true }))
  collection.listRule = "@request.auth.id != \"\""
  collection.viewRule = "@request.auth.id != \"\""
  collection.createRule = "@request.auth.id != \"\""
  collection.updateRule = "@request.auth.id != \"\""
  collection.deleteRule = "@request.auth.id != \"\""
  app.save(collection)
  const programsId = collection.id

  // Terms
  collection = new Collection({ type: "base", name: "terms" })
  collection.fields.add(new TextField({ name: "name", required: true, presentable: true }))
  collection.listRule = "@request.auth.id != \"\""
  collection.viewRule = "@request.auth.id != \"\""
  collection.createRule = "@request.auth.id != \"\""
  collection.updateRule = "@request.auth.id != \"\""
  collection.deleteRule = "@request.auth.id != \"\""
  app.save(collection)
  const termsId = collection.id

  // Courses
  collection = new Collection({ type: "base", name: "courses" })
  collection.fields.add(new RelationField({
    name: "program_id", required: true,
    collectionId: programsId, cascadeDelete: true, maxSelect: 1,
  }))
  collection.fields.add(new RelationField({
    name: "term_id", required: true,
    collectionId: termsId, cascadeDelete: true, maxSelect: 1,
  }))
  collection.fields.add(new TextField({ name: "code", required: true }))
  collection.fields.add(new TextField({ name: "name", required: true, presentable: true }))
  collection.fields.add(new NumberField({ name: "akts" }))
  collection.fields.add(new TextField({ name: "instructor" }))
  collection.fields.add(new TextField({ name: "grade_level" }))
  collection.fields.add(new NumberField({ name: "pct_vize" }))
  collection.fields.add(new NumberField({ name: "pct_odev" }))
  collection.fields.add(new NumberField({ name: "pct_uygulama" }))
  collection.fields.add(new NumberField({ name: "pct_final" }))
  collection.fields.add(new NumberField({ name: "pct_but" }))
  collection.indexes = ["CREATE INDEX idx_courses_program_term ON courses (program_id, term_id)"]
  collection.listRule = "@request.auth.id != \"\""
  collection.viewRule = "@request.auth.id != \"\""
  collection.createRule = "@request.auth.id != \"\""
  collection.updateRule = "@request.auth.id != \"\""
  collection.deleteRule = "@request.auth.id != \"\""
  app.save(collection)
  const coursesId = collection.id

  // Program outcomes
  collection = new Collection({ type: "base", name: "program_outcomes" })
  collection.fields.add(new RelationField({
    name: "program_id", required: true,
    collectionId: programsId, cascadeDelete: true, maxSelect: 1,
  }))
  collection.fields.add(new TextField({ name: "code", required: true }))
  collection.fields.add(new TextField({ name: "description" }))
  collection.listRule = "@request.auth.id != \"\""
  collection.viewRule = "@request.auth.id != \"\""
  collection.createRule = "@request.auth.id != \"\""
  collection.updateRule = "@request.auth.id != \"\""
  collection.deleteRule = "@request.auth.id != \"\""
  app.save(collection)

  // Course outcomes
  collection = new Collection({ type: "base", name: "course_outcomes" })
  collection.fields.add(new RelationField({
    name: "course_id", required: true,
    collectionId: coursesId, cascadeDelete: true, maxSelect: 1,
  }))
  collection.fields.add(new TextField({ name: "code", required: true }))
  collection.fields.add(new TextField({ name: "description" }))
  collection.listRule = "@request.auth.id != \"\""
  collection.viewRule = "@request.auth.id != \"\""
  collection.createRule = "@request.auth.id != \"\""
  collection.updateRule = "@request.auth.id != \"\""
  collection.deleteRule = "@request.auth.id != \"\""
  app.save(collection)

  // Matrix
  collection = new Collection({ type: "base", name: "matrix" })
  collection.fields.add(new RelationField({
    name: "course_id", required: true,
    collectionId: coursesId, cascadeDelete: true, maxSelect: 1,
  }))
  collection.fields.add(new TextField({ name: "dc_code", required: true }))
  collection.fields.add(new TextField({ name: "pc_code", required: true }))
  collection.fields.add(new NumberField({ name: "value" }))
  collection.indexes = ["CREATE UNIQUE INDEX idx_matrix_course_dc_pc ON matrix (course_id, dc_code, pc_code)"]
  collection.listRule = "@request.auth.id != \"\""
  collection.viewRule = "@request.auth.id != \"\""
  collection.createRule = "@request.auth.id != \"\""
  collection.updateRule = "@request.auth.id != \"\""
  collection.deleteRule = "@request.auth.id != \"\""
  app.save(collection)

  // Questions
  collection = new Collection({ type: "base", name: "questions" })
  collection.fields.add(new RelationField({
    name: "course_id", required: true,
    collectionId: coursesId, cascadeDelete: true, maxSelect: 1,
  }))
  collection.fields.add(new TextField({ name: "code", required: true }))
  collection.fields.add(new TextField({ name: "description" }))
  collection.fields.add(new TextField({ name: "exam_type", required: true }))
  collection.fields.add(new TextField({ name: "question_type", required: true }))
  collection.fields.add(new TextField({ name: "dc_code" }))
  collection.fields.add(new NumberField({ name: "max_score" }))
  collection.fields.add(new TextField({ name: "answer_key" }))
  collection.listRule = "@request.auth.id != \"\""
  collection.viewRule = "@request.auth.id != \"\""
  collection.createRule = "@request.auth.id != \"\""
  collection.updateRule = "@request.auth.id != \"\""
  collection.deleteRule = "@request.auth.id != \"\""
  app.save(collection)
  const questionsId = collection.id

  // Students
  collection = new Collection({ type: "base", name: "students" })
  collection.fields.add(new RelationField({
    name: "course_id", required: true,
    collectionId: coursesId, cascadeDelete: true, maxSelect: 1,
  }))
  collection.fields.add(new TextField({ name: "student_no", required: true }))
  collection.fields.add(new TextField({ name: "full_name", required: true }))
  collection.indexes = ["CREATE UNIQUE INDEX idx_student_course_no ON students (course_id, student_no)"]
  collection.listRule = "@request.auth.id != \"\""
  collection.viewRule = "@request.auth.id != \"\""
  collection.createRule = "@request.auth.id != \"\""
  collection.updateRule = "@request.auth.id != \"\""
  collection.deleteRule = "@request.auth.id != \"\""
  app.save(collection)
  const studentsId = collection.id

  // Student grades
  collection = new Collection({ type: "base", name: "student_grades" })
  collection.fields.add(new RelationField({
    name: "student_id", required: true,
    collectionId: studentsId, cascadeDelete: true, maxSelect: 1,
  }))
  collection.fields.add(new RelationField({
    name: "question_id", required: true,
    collectionId: questionsId, cascadeDelete: true, maxSelect: 1,
  }))
  collection.fields.add(new NumberField({ name: "score" }))
  collection.indexes = ["CREATE UNIQUE INDEX idx_grade_student_question ON student_grades (student_id, question_id)"]
  collection.listRule = "@request.auth.id != \"\""
  collection.viewRule = "@request.auth.id != \"\""
  collection.createRule = "@request.auth.id != \"\""
  collection.updateRule = "@request.auth.id != \"\""
  collection.deleteRule = "@request.auth.id != \"\""
  app.save(collection)

  return null
}, (app) => {
  return null
})
