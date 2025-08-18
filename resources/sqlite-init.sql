-- 本地账户表（存储登录过的账户信息）
CREATE TABLE IF NOT EXISTS local_account (
    account TEXT PRIMARY KEY NOT NULL, -- 登录账户（用户名/手机号）
    password TEXT NOT NULL, -- 加密存储的密码
    avatar_url TEXT NOT NULL DEFAULT 'default_avatar.png', -- 头像URL，默认使用系统头像
    is_agree INTEGER -- 是否同意服务协议（0-未同意，1-已同意）
);

-- 用户资料表（与后端同步的用户基本信息）
CREATE TABLE IF NOT EXISTS user_profile (
    id TEXT PRIMARY KEY NOT NULL, -- 用户唯一标识（后端Long转字符串存储）
    username TEXT NOT NULL, -- 用户名
    masked_email TEXT, -- 脱敏邮箱（如：xxx@xx.com）
    masked_phone TEXT, -- 脱敏手机号（如：138****5678）
    avatar_url TEXT DEFAULT 'default_avatar.png', -- 头像URL
    signature TEXT, -- 个性签名
    gender TEXT NOT NULL DEFAULT '0', -- 性别（0-未知，1-男，2-女）
    birthdate TEXT, -- 出生日期（格式：yyyy-MM-dd）
    status INTEGER NOT NULL DEFAULT 1, -- 状态（0-禁用，1-正常，2-冻结）
    created_at INTEGER NOT NULL, -- 注册时间戳（毫秒）
    updated_at INTEGER NOT NULL -- 最后更新时间戳（毫秒）
);

-- 群聊表
CREATE TABLE IF NOT EXISTS "group" (
    id TEXT PRIMARY KEY NOT NULL, -- 群聊ID
    name TEXT NOT NULL, -- 群聊名称
    create_user TEXT NOT NULL, -- 创建者用户ID
    avatar TEXT DEFAULT 'default_group_avatar.png', -- 群头像文件名
    signature TEXT DEFAULT '', -- 群简介
    number INTEGER DEFAULT 0, -- 群成员数量
    status INTEGER DEFAULT 0, -- 状态（0-正常，1-删除，2-禁用）
    created_at INTEGER, -- 创建时间戳（毫秒）
    updated_at INTEGER -- 最后更新时间戳（毫秒）
);

-- 聊天消息表
CREATE TABLE IF NOT EXISTS message (
    id TEXT PRIMARY KEY NOT NULL, -- 消息ID
    type INTEGER NOT NULL, -- 消息类型（1-文本，2-图片，3-文件等）
    from_id TEXT NOT NULL, -- 发送者ID（用户ID）
    to_id TEXT NOT NULL, -- 接收者ID（用户ID或群聊ID）
    content TEXT, -- 消息内容（文本消息直接存储，其他类型存资源标识）
    status INTEGER DEFAULT 1, -- 状态（1-正常，2-撤回，3-删除）
    created_at INTEGER, -- 发送时间戳（毫秒）
    updated_at INTEGER -- 状态更新时间戳（毫秒）
);

-- 群聊成员关联表
CREATE TABLE IF NOT EXISTS group_member (
    id TEXT PRIMARY KEY NOT NULL, -- 记录ID
    group_id TEXT NOT NULL, -- 所属群聊ID
    user_id TEXT NOT NULL, -- 成员用户ID
    remark TEXT, -- 群内备注名
    status INTEGER DEFAULT 0, -- 成员状态（0-正常，1-禁用，2-退出）
    role INTEGER DEFAULT 3, -- 成员角色（1-群主，2-管理员，3-普通成员）
    created_at INTEGER, -- 加入时间戳（毫秒）
    updated_at INTEGER, -- 信息更新时间戳（毫秒）
    UNIQUE (group_id, user_id) -- 确保用户在群内唯一
);

-- 好友申请表
CREATE TABLE IF NOT EXISTS friend_request (
    id TEXT PRIMARY KEY NOT NULL, -- 申请记录ID
    from_id TEXT NOT NULL, -- 申请人用户ID
    to_id TEXT NOT NULL, -- 被申请人用户ID
    from_remark TEXT DEFAULT '', -- 申请人对被申请人的备注
    to_remark TEXT, -- 被申请人对申请人的备注（通过时填写）
    statement TEXT DEFAULT '', -- 申请留言
    status INTEGER DEFAULT 0, -- 状态（0-待处理，1-已通过，2-已拒绝）
    created_at INTEGER, -- 申请时间戳（毫秒）
    updated_at INTEGER -- 状态更新时间戳（毫秒）
);

CREATE TABLE IF NOT EXISTS user_friend (
    id            TEXT PRIMARY KEY, --AUTOINCREMENT COMMENT '关系ID，主键',
    user_id       TEXT NOT NULL, --COMMENT '用户ID',
    friend_id     TEXT NOT NULL, --COMMENT '好友ID',
    block_status  INTEGER DEFAULT 1, --COMMENT '黑名单类型：0正常，1已拉黑，2被拉黑，3相互拉黑',
    delete_status INTEGER DEFAULT 1, --COMMENT '删除类型：0正常，1已删除，2被删除，3相互删除',
    remark        VARCHAR(64) DEFAULT '', --COMMENT '好友备注',
    created_at    INTEGER, --COMMENT '创建时间',
    updated_at    INTEGER, --COMMENT '更新时间',
    CONSTRAINT uniq_user_friend UNIQUE (user_id, friend_id)
);