-- smeLab account (DECISIONS A-01): sign-in happens at smeLab; each JualanLab user is linked to one smeLab account.
ALTER TABLE users ADD COLUMN smelab_id TEXT;
CREATE UNIQUE INDEX users_smelab ON users (smelab_id);
