/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = new Collection({
    "id": "programs_coll00",
    "created": "2026-06-08 16:35:48.143Z",
    "updated": "2026-06-08 16:35:48.143Z",
    "name": "programs",
    "type": "base",
    "system": false,
    "fields": [
      {
        "system": false,
        "id": "prg_name_field",
        "name": "name",
        "type": "text",
        "required": true,
        "presentable": true,
        "unique": false,
        "options": {
          "min": null,
          "max": null,
          "pattern": ""
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
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("programs_coll00");

  return app.delete(collection);
})
