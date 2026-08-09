const db = require("../config/db");

const Project = {
    async create(project) {

        const sql = `
            INSERT INTO projects(
                user_id,
                title,
                description,
                input_image
            )
            VALUES (?, ?, ?, ?)
        `;

        const [result] = await db.query(
            sql,
            [
                project.user_id,
                project.title,
                project.description,
                project.input_image
            ]
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

    async findByUserId(userId) {           
        const [rows] = await db.query(
            "SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC",
            [userId]
        );
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
    },

    async updateAIOutputs(id, outputs) {
        const sql = `
            UPDATE projects
            SET
                geometric_image = ?,
                curve_image = ?,
                shading_image = ?,
                colouring_image = ?,
                status = 'Completed'
            WHERE id = ?
        `;

        const [result] = await db.query(
            sql,
            [
                outputs.geometric_image,
                outputs.curve_image,
                outputs.shading_image,
                outputs.colouring_image,
                id
            ]
        );

        return result;
    },


    async updateStatus(id, status) {
        const [result] = await db.query(
            `
            UPDATE projects
            SET status = ?
            WHERE id = ?
            `,
            [status, id]
        );

        return result;
    },
};

module.exports = Project;