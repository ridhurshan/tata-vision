const db = require("../config/db");

const Project = {
    async create(project) {
        const sql = `
            INSERT INTO projects(user_id, title, description)
            VALUES (?, ?, ?)
        `;
        const [result] = await db.query(
            sql,
            [project.user_id, project.title, project.description]
        );
        return result;
    },

    async findAll() {
        const [rows] = await db.query("SELECT * FROM projects ORDER BY created_at DESC");
        return rows;
    },

    async findById(id) {
        const [rows] = await db.query("SELECT * FROM projects WHERE id = ?", [id]);
        return rows;
    },

    async update(id, project) {
        const sql = `
            UPDATE projects
            SET title=?, description=?, status=?
            WHERE id=?
        `;
        const [result] = await db.query(
            sql,
            [project.title, project.description, project.status, id]
        );
        return result;
    },

    async delete(id) {
        const [result] = await db.query("DELETE FROM projects WHERE id=?", [id]);
        return result;
    }
};

module.exports = Project;