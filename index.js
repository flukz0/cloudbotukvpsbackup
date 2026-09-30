require('dotenv').config();

const { 
    Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, 
    ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, 
    ChannelType, PermissionFlagsBits, ActivityType, StringSelectMenuBuilder, 
    StringSelectMenuOptionBuilder, UserSelectMenuBuilder, REST, Routes, SlashCommandBuilder 
} = require('discord.js');
const fs = require('fs');
const axios = require('axios');

// Environment Configuration
const CONFIG = {
    PREFIX: process.env.PREFIX || '!',
    PANEL_URL: process.env.PANEL_URL || '',
    PTERO_API_KEY: process.env.PTERO_API_KEY || process.env.PTERO_CLIENT_KEY || '',
    LOG_CHANNEL_ID: process.env.LOG_CHANNEL_ID || '',
    TICKET_LOG_CHANNEL_ID: process.env.TICKET_LOG_CHANNEL_ID || process.env.LOG_CHANNEL_ID || '',
    STATUS_CHANNEL_ID: process.env.STATUS_CHANNEL_ID || '',
    CLOUDTEAM_ROLE_ID: process.env.CLOUDTEAM_ROLE_ID || '',
    GUILD_ID: process.env.GUILD_ID || '',
    DEFAULT_NODE_ID: parseInt(process.env.DEFAULT_NODE_ID || '1'),
    DEFAULT_NEST_ID: parseInt(process.env.DEFAULT_NEST_ID || '1'),
    DEFAULT_EGG_ID: parseInt(process.env.DEFAULT_EGG_ID || '4'),
    CATEGORIES: {
        general_support: process.env.CATEGORY_GENERAL,
        bug_report: process.env.CATEGORY_BUG,
        claim_rewards: process.env.CATEGORY_REWARD,
        partnership: process.env.CATEGORY_PARTNERSHIP,
        closed: process.env.CATEGORY_CLOSED
    },
    EMOJIS: {
        online: process.env.EMOJI_ONLINE || '🟢',
        offline: process.env.EMOJI_OFFLINE || '🔴',
        starting: process.env.EMOJI_STARTING || '🟡',
        stopping: process.env.EMOJI_STOPPING || '🔴',
        ticket: process.env.EMOJI_TICKET || '🎫',
        general: process.env.EMOJI_GENERAL || '💬',
        bug: process.env.EMOJI_BUG || '🐞',
        reward: process.env.EMOJI_REWARD || '🎁',
        partnership: process.env.EMOJI_PARTNERSHIP || '🤝',
        claim: process.env.EMOJI_CLAIM || '🫴🏻',
        addUser: process.env.EMOJI_ADD_USER || '➕',
        removeUser: process.env.EMOJI_REMOVE_USER || '➖',
        close: process.env.EMOJI_CLOSE || '🔒',
        server: process.env.EMOJI_SERVER || '🖥️',
        warn: process.env.EMOJI_WARN || '⚠️',
        ping: process.env.EMOJI_PING || '🏓'
    }
};

const DB_FILE = './suspensions.json';

function fmtIST(dateInput = new Date()) {
    return new Date(dateInput).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        dateStyle: 'medium',
        timeStyle: 'medium',
        hour12: true
    }) + ' IST';
}

function fmtUptime(ms) {
    const sec = Math.floor((ms / 1000) % 60);
    const min = Math.floor((ms / (1000 * 60)) % 60);
    const hrs = Math.floor((ms / (1000 * 60 * 60)) % 24);
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    return `${days} days, ${hrs} hours, ${min} minutes and ${sec} seconds`;
}

function createEmbed(title, description = null, color = '#00d2ff', fields = []) {
    const emb = new EmbedBuilder().setTitle(title).setColor(color).setFooter({ text: `CloudCastle • ${fmtIST()}` }).setTimestamp();
    if (description) emb.setDescription(description);
    if (fields.length) emb.addFields(fields);
    return emb;
}

function buildTicketPanelEmbed() {
    return new EmbedBuilder()
        .setTitle(`🎟️ Support Ticket System`)
        .setColor('#00d2ff')
        .setDescription(
            `- ${CONFIG.EMOJIS.general} **General Support**\n` +
            `\`GENERAL SUPPORT & QUESTIONS\`\n\n` +
            `- ${CONFIG.EMOJIS.bug} **Bug Report**\n` +
            `\`REPORT A BUG OR ISSUE\`\n\n` +
            `- ${CONFIG.EMOJIS.partnership} **Partnership**\n` +
            `\`PARTNERSHIP & COLLABORATION INQUIRIES\`\n\n` +
            `- ${CONFIG.EMOJIS.reward} **Claim Rewards**\n` +
            `\`CLAIM YOUR REWARDS & PRIZES\`\n\n` +
            `- **Note**\n` +
            `Creating tickets without reason will result in a **punishment 🚫**`
        )
        .setFooter({ text: `Ticket System | CloudCastle` });
}

function getTicketDropdown() {
    return new StringSelectMenuBuilder()
        .setCustomId('ticket_select_menu')
        .setPlaceholder('Select a ticket category to open >')
        .addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel('General Support')
                .setValue('general_support')
                .setDescription('General support & questions')
                .setEmoji(CONFIG.EMOJIS.general),
            new StringSelectMenuOptionBuilder()
                .setLabel('Bug Report')
                .setValue('bug_report')
                .setDescription('Report a bug or issue')
                .setEmoji(CONFIG.EMOJIS.bug),
            new StringSelectMenuOptionBuilder()
                .setLabel('Partnership')
                .setValue('partnership')
                .setDescription('Partnership & collaboration inquiries')
                .setEmoji(CONFIG.EMOJIS.partnership),
            new StringSelectMenuOptionBuilder()
                .setLabel('Claim Rewards')
                .setValue('claim_rewards')
                .setDescription('Claim your rewards & prizes')
                .setEmoji(CONFIG.EMOJIS.reward)
        );
}

function getTicketActionRow(isClaimed = false, isClosed = false) {
    if (isClosed) {
        return [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('reopen_ticket_btn').setLabel('🔓 Reopen Ticket').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('delete_ticket_btn').setLabel('🗑️ Delete Ticket').setStyle(ButtonStyle.Danger)
            )
        ];
    }

    const claimBtn = isClaimed
        ? new ButtonBuilder().setCustomId('unclaim_ticket').setLabel('🔓 Unclaim Ticket').setStyle(ButtonStyle.Secondary)
        : new ButtonBuilder().setCustomId('claim_ticket').setLabel(`${CONFIG.EMOJIS.claim} Claim Ticket`).setStyle(ButtonStyle.Success);

    const row1 = new ActionRowBuilder().addComponents(
        claimBtn,
        new ButtonBuilder().setCustomId('add_user_btn').setLabel(`${CONFIG.EMOJIS.addUser} Add User`).setStyle(ButtonStyle.Primary)
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('remove_user_btn').setLabel(`${CONFIG.EMOJIS.removeUser} Remove User`).setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('close_ticket').setLabel(`${CONFIG.EMOJIS.close} Close Ticket`).setStyle(ButtonStyle.Secondary)
    );

    return [row1, row2];
}

const slashCommands = [
    new SlashCommandBuilder().setName('help').setDescription('Displays list of all available commands'),
    new SlashCommandBuilder().setName('ping').setDescription('Check bot latency'),
    new SlashCommandBuilder().setName('status').setDescription('Check Panel & System status'),
    new SlashCommandBuilder().setName('list').setDescription('List all Pterodactyl servers'),
    new SlashCommandBuilder().setName('setup-ticket').setDescription('Deploy Ticket Portal'),
    new SlashCommandBuilder().setName('ticket').setDescription('Manage support tickets')
        .addSubcommand(sub => sub.setName('setup').setDescription('Deploy Ticket Portal'))
        .addSubcommand(sub => sub.setName('close').setDescription('Close current ticket'))
        .addSubcommand(sub => sub.setName('reopen').setDescription('Reopen closed ticket'))
        .addSubcommand(sub => sub.setName('claim').setDescription('Claim current ticket'))
        .addSubcommand(sub => sub.setName('unclaim').setDescription('Unclaim current ticket'))
        .addSubcommand(sub => sub.setName('add').setDescription('Add user to ticket').addUserOption(opt => opt.setName('user').setDescription('User to add').setRequired(true)))
        .addSubcommand(sub => sub.setName('remove').setDescription('Remove user from ticket').addUserOption(opt => opt.setName('user').setDescription('User to remove').setRequired(true))),
    new SlashCommandBuilder().setName('suspended').setDescription('List all suspended servers'),
    new SlashCommandBuilder().setName('suspend').setDescription('Suspend a server').addStringOption(opt => opt.setName('server').setDescription('Server ID or Name').setRequired(true)).addNumberOption(opt => opt.setName('hours').setDescription('Hours until auto-suspension')),
    new SlashCommandBuilder().setName('unsuspend').setDescription('Unsuspend a server').addStringOption(opt => opt.setName('server').setDescription('Server ID or Name').setRequired(true)),
    new SlashCommandBuilder().setName('renew').setDescription('Renew a server subscription').addStringOption(opt => opt.setName('server').setDescription('Server ID or Name').setRequired(true)).addNumberOption(opt => opt.setName('days').setDescription('Days to extend expiry').setRequired(true)),
    new SlashCommandBuilder().setName('cloudcreate').setDescription('Create a new server on panel')
        .addStringOption(opt => opt.setName('name').setDescription('Server Name').setRequired(true))
        .addStringOption(opt => opt.setName('user').setDescription('Panel User ID or Email').setRequired(true))
        .addStringOption(opt => opt.setName('plan').setDescription('Select Plan Expiry').setRequired(true).addChoices(
            { name: 'Free Plan (1 Week / 7 Days Expiry)', value: 'free' },
            { name: 'Creator Plan (1 Month / 30 Days Expiry)', value: 'creator' },
            { name: 'Paid Plan (1 Month / 30 Days Expiry)', value: 'paid' }
        ))
        .addNumberOption(opt => opt.setName('ram').setDescription('RAM in GB').setRequired(true))
        .addNumberOption(opt => opt.setName('disk').setDescription('Storage in GB').setRequired(true))
        .addIntegerOption(opt => opt.setName('cpu').setDescription('CPU limit in %').setRequired(true)),
    new SlashCommandBuilder().setName('clouddelete').setDescription('Delete a server').addStringOption(opt => opt.setName('server').setDescription('Server ID or Name').setRequired(true)),
    new SlashCommandBuilder().setName('usercreate').setDescription('Create a user on panel').addStringOption(opt => opt.setName('email').setDescription('User Email').setRequired(true)).addStringOption(opt => opt.setName('username').setDescription('Username').setRequired(true)).addStringOption(opt => opt.setName('firstname').setDescription('First Name')).addStringOption(opt => opt.setName('lastname').setDescription('Last Name')),
    new SlashCommandBuilder().setName('userdelete').setDescription('Delete a user from panel').addStringOption(opt => opt.setName('user').setDescription('User ID or Email').setRequired(true))
].map(cmd => cmd.toJSON());

function loadDb() {
    if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({ closedTickets: {}, statusMsgId: null }));
    try { 
        const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        if (!data.closedTickets) data.closedTickets = {};
        return data;
    } catch { return { closedTickets: {}, statusMsgId: null }; }
}
function saveDb(data) { fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2)); }

async function pteroReq(method, endpoint, body = null) {
    try {
        const res = await axios({
            method,
            url: `${CONFIG.PANEL_URL.replace(/\/$/, '')}/api/application/${endpoint}`,
            headers: { 'Authorization': `Bearer ${CONFIG.PTERO_API_KEY}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
            timeout: 10000,
            data: body
        });
        return res.data;
    } catch (e) {
        throw new Error(e.response?.data?.errors?.[0]?.detail || e.message);
    }
}

async function getEggEnvironment(nestId, eggId) {
    const env = { SERVER_JARFILE: 'server.jar', VANILLA_VERSION: 'latest', BUILD_NUMBER: 'latest', MINECRAFT_VERSION: 'latest', DL_PATH: '' };
    try {
        const res = await pteroReq('get', `nests/${nestId}/eggs/${eggId}?include=variables`);
        if (res?.attributes?.relationships?.variables?.data) {
            res.attributes.relationships.variables.data.forEach(v => {
                const attr = v.attributes;
                if (attr.env_variable) env[attr.env_variable] = attr.default_value || 'latest';
            });
        }
    } catch (e) {}
    return env;
}

async function getUnassignedAllocation(nodeId) {
    let page = 1;
    while (page <= 5) {
        const res = await pteroReq('get', `nodes/${nodeId}/allocations?page=${page}&per_page=50`);
        if (res && res.data) {
            const freeAlloc = res.data.find(a => !a.attributes.assigned);
            if (freeAlloc) return freeAlloc.attributes.id;
            if (page >= (res.meta?.pagination?.total_pages || 1)) break;
            page++;
        } else break;
    }
    throw new Error(`No free allocations available on Node ID ${nodeId}!`);
}

async function findServer(query) {
    const q = query.toLowerCase().trim();
    let page = 1;
    while (page <= 10) {
        const res = await pteroReq('get', `servers?page=${page}&per_page=50`);
        const match = res.data.find(s => s.attributes.id.toString() === q || s.attributes.identifier.toLowerCase() === q || s.attributes.name.toLowerCase() === q);
        if (match) return match.attributes;
        if (page >= (res.meta?.pagination?.total_pages || 1)) break;
        page++;
    }
    return null;
}

async function findUser(query) {
    const q = query.toLowerCase().trim();
    if (/^\d+$/.test(q)) {
        try {
            const res = await pteroReq('get', `users/${q}`);
            if (res && res.attributes) return res.attributes;
        } catch (e) {}
    }

    let page = 1;
    while (page <= 10) {
        const res = await pteroReq('get', `users?page=${page}&per_page=50`);
        const match = res.data.find(u => u.attributes.id.toString() === q || u.attributes.email.toLowerCase() === q || u.attributes.username.toLowerCase() === q);
        if (match) return match.attributes;
        if (page >= (res.meta?.pagination?.total_pages || 1)) break;
        page++;
    }
    return null;
}

function isAuth(member) {
    if (!member) return false;
    if (member.permissions.has(PermissionFlagsBits.Administrator) || member.guild.ownerId === member.id) return true;
    if (CONFIG.CLOUDTEAM_ROLE_ID && member.roles.cache.has(CONFIG.CLOUDTEAM_ROLE_ID)) return true;
    return false;
}

async function sendLog(client, title, fields = [], color = '#00d2ff', isTicketLog = false) {
    const chId = isTicketLog ? CONFIG.TICKET_LOG_CHANNEL_ID : CONFIG.LOG_CHANNEL_ID;
    if (!chId) return;
    try {
        const ch = await client.channels.fetch(chId);
        if (ch) await ch.send({ embeds: [createEmbed(title, null, color, fields)] });
    } catch (err) {}
}

async function handleTicketClose(channel, user, guild) {
    if (CONFIG.CATEGORIES.closed) await channel.setParent(CONFIG.CATEGORIES.closed, { lockPermissions: false }).catch(() => {});
    await channel.setName('closed-ticket').catch(() => {});

    try {
        const overwrites = channel.permissionOverwrites.cache;
        for (const [id] of overwrites) {
            if (id !== guild.id && id !== CONFIG.CLOUDTEAM_ROLE_ID) {
                await channel.permissionOverwrites.edit(id, { SendMessages: false }).catch(() => {});
            }
        }
    } catch (e) {}

    const db = loadDb();
    db.closedTickets[channel.id] = { closedAt: Date.now(), channelId: channel.id, closedBy: user.tag };
    saveDb(db);

    await sendLog(client, '🔒 Ticket Closed', [
        { name: 'Ticket Channel', value: channel.name, inline: true },
        { name: 'Closed By', value: user.tag, inline: true },
        { name: 'Auto-Delete', value: 'Scheduled in 2 days if unopened', inline: false }
    ], '#ffa500', true);

    await channel.send({ 
        embeds: [createEmbed('🔒 Ticket Closed', `Closed by **${user}**.\n\n• **Reopen:** Staff can reopen below.\n• **Auto-Delete:** If not reopened, deleted in 2 days.`, '#ffa500')], 
        components: getTicketActionRow(false, true) 
    });
}

async function handleTicketReopen(channel, user, guild, member) {
    if (!isAuth(member)) throw new Error('Only CloudTeam staff members can reopen closed tickets!');

    const targetCategoryId = CONFIG.CATEGORIES.general_support || null;
    if (targetCategoryId) await channel.setParent(targetCategoryId, { lockPermissions: false }).catch(() => {});
    await channel.setName('need-staff-reply').catch(() => {});

    try {
        const overwrites = channel.permissionOverwrites.cache;
        for (const [id] of overwrites) {
            if (id !== guild.id) {
                await channel.permissionOverwrites.edit(id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true }).catch(() => {});
            }
        }
    } catch (e) {}

    const db = loadDb();
    delete db.closedTickets[channel.id];
    saveDb(db);

    await sendLog(client, '🔓 Ticket Reopened', [{ name: 'Ticket Channel', value: channel.name, inline: true }, { name: 'Reopened By', value: user.tag, inline: true }], '#00ff88', true);
    await channel.send({ embeds: [createEmbed('🔓 Ticket Active', `Reopened by ${user}.`, '#00ff88')], components: getTicketActionRow(false, false) });
}

const helpEmbed = createEmbed(
    '📜 CloudCastle Bot - Command List',
    'Commands work with both `/` slash commands and `!` prefix commands:',
    '#00d2ff',
    [
        { name: '🌐 General Commands', value: '• `/help` or `!help`\n• `/ping` or `!ping`\n• `/status` or `!status`', inline: false },
        { name: '🎟️ Support Ticket Commands', value: '• `/setup-ticket` or `!ticket setup`\n• `/ticket close`, `reopen`, `claim`, `unclaim`\n• `/ticket add <@user>`\n• `/ticket remove <@user>`', inline: false },
        { name: '🖥️ Server Management (Staff)', value: '• `/cloudcreate`, `/clouddelete`\n• `/list`, `/suspend`, `/unsuspend`, `/renew`\n• `/suspended`', inline: false },
        { name: '👤 User Management (Staff)', value: '• `/usercreate`, `/userdelete`', inline: false }
    ]
);

let statusCountdown = 10;
async function startLiveStatusTask(client) {
    setInterval(async () => {
        if (!CONFIG.STATUS_CHANNEL_ID) return;
        statusCountdown--;
        if (statusCountdown > 0) return;
        statusCountdown = 10;

        try {
            const statusChannel = await client.channels.fetch(CONFIG.STATUS_CHANNEL_ID).catch(() => null);
            if (!statusChannel) return;

            const nodesRes = await pteroReq('get', 'nodes?include=servers').catch(() => null);
            const usersRes = await pteroReq('get', 'users?per_page=1').catch(() => null);
            const serversRes = await pteroReq('get', 'servers?per_page=1').catch(() => null);

            const isOnline = !!nodesRes;
            const nodesCount = nodesRes?.data?.length || 0;
            const serversCount = serversRes?.meta?.pagination?.total || 0;
            const usersCount = usersRes?.meta?.pagination?.total || 0;
            const uptimeStr = fmtUptime(client.uptime);

            const consoleEmbed = new EmbedBuilder().setColor('#5865F2').setTitle('Console Stats').setDescription(`Next update in **${statusCountdown} seconds**\n\nPanel - ${isOnline ? CONFIG.EMOJIS.online : CONFIG.EMOJIS.offline} ${isOnline ? 'Online' : 'Offline'}\n\`\`\`\nNodes   : ${nodesCount}\nServers : ${serversCount}\nUsers   : ${usersCount}\nUptime  : ${uptimeStr}\n\`\`\``);

            let nodeFieldsText = '';
            if (nodesRes && nodesRes.data) {
                nodesRes.data.forEach(node => {
                    const attr = node.attributes;
                    const serverCount = attr.relationships?.servers?.data?.length || 0;
                    nodeFieldsText += `**Location: ${attr.name}** - ${CONFIG.EMOJIS.online} Online\n\`\`\`\nServers : ${serverCount}\nUptime  : ${uptimeStr}\n\`\`\`\n`;
                });
            } else {
                nodeFieldsText = `Location: Main Node - ${CONFIG.EMOJIS.offline} Offline\n\`\`\`\nServers : N/A\nUptime  : N/A\n\`\`\``;
            }

            const nodesEmbed = new EmbedBuilder().setColor('#f1c40f').setTitle('Nodes Stats').setDescription(nodeFieldsText).setFooter({ text: `By @CloudCastleTeam | Today at ${new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })}` });

            const db = loadDb();
            let statusMsg = db.statusMsgId ? await statusChannel.messages.fetch(db.statusMsgId).catch(() => null) : null;
            if (statusMsg) await statusMsg.edit({ embeds: [consoleEmbed, nodesEmbed] });
            else {
                const newMsg = await statusChannel.send({ embeds: [consoleEmbed, nodesEmbed] });
                db.statusMsgId = newMsg.id;
                saveDb(db);
            }
        } catch (e) {}
    }, 1000);
}

function startAutoCronTask(client) {
    setInterval(async () => {
        const db = loadDb();
        const now = Date.now();

        for (const key of Object.keys(db)) {
            if (key === 'closedTickets' || key === 'statusMsgId') continue;
            const item = db[key];
            if (item && !item.isSuspended && item.suspendAt && now >= item.suspendAt) {
                try {
                    await pteroReq('post', `servers/${item.serverId}/suspend`);
                    db[key].isSuspended = true;
                    saveDb(db);
                    await sendLog(client, `${CONFIG.EMOJIS.offline} Auto-Log: Server Suspended`, [{ name: 'Server ID', value: String(item.serverId), inline: true }, { name: 'Reason', value: 'Scheduled Plan Expiry Reached', inline: true }], '#ff3333');
                } catch (err) {}
            }
        }

        if (db.closedTickets) {
            for (const chId of Object.keys(db.closedTickets)) {
                const ticketInfo = db.closedTickets[chId];
                if (now - ticketInfo.closedAt >= 2 * 86400000) {
                    try {
                        const channel = await client.channels.fetch(chId).catch(() => null);
                        if (channel) {
                            await sendLog(client, '🗑️ Ticket Auto-Deleted', [{ name: 'Channel ID', value: chId, inline: true }, { name: 'Closed By', value: ticketInfo.closedBy || 'Unknown', inline: true }, { name: 'Reason', value: 'Unopened for 2 consecutive days', inline: false }], '#ff3333', true);
                            await channel.delete().catch(() => {});
                        }
                    } catch (e) {}
                    delete db.closedTickets[chId];
                    saveDb(db);
                }
            }
        }
    }, 60000);
}

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers],
    partials: [Partials.Channel, Partials.Message]
});

client.on('ready', async () => {
    console.log(`Logged in as ${client.user.tag}! CloudCastle Bot Online.`);
    client.user.setPresence({ activities: [{ name: 'CloudCastle Hosting', type: ActivityType.Playing }], status: 'online' });
    try {
        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
        if (CONFIG.GUILD_ID) await rest.put(Routes.applicationGuildCommands(client.user.id, CONFIG.GUILD_ID), { body: [] }).catch(() => {});
        await rest.put(Routes.applicationCommands(client.user.id), { body: slashCommands });
        console.log('Successfully synchronized global slash commands.');
    } catch (error) {}
    startAutoCronTask(client);
    startLiveStatusTask(client);
});

// Message Listener (Handles Auto-Rename + Full Prefix Commands)
client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    // Handle Auto Ticket Renaming
    const topic = message.channel.topic || '';
    if (topic.includes('OpenerId:')) {
        const isStaff = isAuth(message.member);
        const matchOpenerUser = topic.match(/OpenerUser:([a-z0-9_.-]+)/i);
        const openerUser = matchOpenerUser ? matchOpenerUser[1] : 'user';

        if (isStaff && message.channel.name === 'need-staff-reply') {
            await message.channel.setName(`need-${openerUser}-reply`).catch(() => {});
        }
    }

    if (!message.content.startsWith(CONFIG.PREFIX)) return;
    const args = message.content.slice(CONFIG.PREFIX.length).trim().split(/ +/);
    const cmd = args.shift().toLowerCase();
    const member = message.member;

    try {
        if (cmd === 'help') return message.reply({ embeds: [helpEmbed] });
        if (cmd === 'ping') return message.reply({ embeds: [createEmbed(`${CONFIG.EMOJIS.ping} Latency Check`, `API Latency: **${client.ws.ping}ms**`, '#00d2ff')] });
        if (cmd === 'status') {
            const nodesRes = await pteroReq('get', 'nodes').catch(() => null);
            const isOnline = !!nodesRes;
            return message.reply({ embeds: [createEmbed('🖥️ System Status', `Panel API: ${isOnline ? CONFIG.EMOJIS.online + ' Online' : CONFIG.EMOJIS.offline + ' Offline'}\nBot Latency: **${client.ws.ping}ms**`, isOnline ? '#00ff88' : '#ff3333')] });
        }

        if (!isAuth(member)) return message.reply({ embeds: [createEmbed('❌ Access Denied', 'You do not have permission to execute this command.', '#ff3333')] });

        if (cmd === 'ticket' || cmd === 'setup-ticket') {
            const sub = cmd === 'setup-ticket' ? 'setup' : args[0]?.toLowerCase();
            if (sub === 'setup') {
                const row = new ActionRowBuilder().addComponents(getTicketDropdown());
                await message.channel.send({ embeds: [buildTicketPanelEmbed()], components: [row] });
                return message.reply({ embeds: [createEmbed('✅ Success', 'Ticket portal deployed successfully!', '#00ff88')] });
            }
            if (sub === 'reopen') return await handleTicketReopen(message.channel, message.author, message.guild, member);
            if (sub === 'close') return await handleTicketClose(message.channel, message.author, message.guild);
            if (sub === 'claim') {
                const topic = message.channel.topic || '';
                if (topic.includes('ClaimedBy:')) return message.reply({ embeds: [createEmbed('❌ Already Claimed', `This ticket is already claimed!`, '#ff3333')] });
                await message.channel.setTopic(`${topic}|ClaimedBy:${message.author.id}`).catch(() => {});
                return message.reply({ embeds: [createEmbed('🫴🏻 Ticket Claimed', `Ticket claimed by ${message.author}`, '#00ff88')] });
            }
            if (sub === 'unclaim') {
                const topic = message.channel.topic || '';
                if (!topic.includes('ClaimedBy:')) return message.reply({ embeds: [createEmbed('❌ Error', 'Ticket has not been claimed!', '#ff3333')] });
                const claimedId = topic.split('ClaimedBy:')[1]?.split('|')[0]?.trim();
                if (claimedId !== message.author.id) return message.reply({ embeds: [createEmbed('❌ Permission Denied', `Only <@${claimedId}> can unclaim it.`, '#ff3333')] });
                const newTopic = topic.replace(/\|?ClaimedBy:\d+/, '');
                await message.channel.setTopic(newTopic).catch(() => {});
                return message.reply({ embeds: [createEmbed('🔓 Ticket Unclaimed', `Ticket unclaimed by ${message.author}`, '#ffa500')] });
            }
            if (sub === 'add') {
                const targetUser = message.mentions.users.first();
                if (!targetUser) return message.reply({ embeds: [createEmbed('❌ Mention Required', 'Mention a user to add.', '#ff3333')] });
                await message.channel.permissionOverwrites.edit(targetUser.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
                return message.reply({ embeds: [createEmbed('➕ User Added', `${targetUser} added to this ticket.`, '#00ff88')] });
            }
            if (sub === 'remove') {
                const targetUser = message.mentions.users.first();
                if (!targetUser) return message.reply({ embeds: [createEmbed('❌ Mention Required', 'Mention a user to remove.', '#ff3333')] });
                await message.channel.permissionOverwrites.delete(targetUser.id);
                return message.reply({ embeds: [createEmbed('➖ User Removed', `${targetUser} removed from this ticket.`, '#ff3333')] });
            }
        }

        if (cmd === 'list') {
            const res = await pteroReq('get', 'servers?per_page=50');
            const servers = res.data.map(s => `• **${s.attributes.name}** (\`ID: ${s.attributes.id}\`)`).join('\n') || 'No servers found.';
            return message.reply({ embeds: [createEmbed('🖥️ Panel Server List', servers, '#00d2ff')] });
        }

        if (cmd === 'suspended') {
            const res = await pteroReq('get', 'servers?per_page=50');
            const suspendedServers = res.data.filter(s => s.attributes.suspended).map(s => `• **${s.attributes.name}** (\`ID: ${s.attributes.id}\`)`).join('\n') || 'No suspended servers found.';
            return message.reply({ embeds: [createEmbed('🔴 Suspended Servers List', suspendedServers, '#ff3333')] });
        }

        if (cmd === 'suspend' || cmd === 'unsuspend' || cmd === 'renew' || cmd === 'clouddelete') {
            if (!args[0]) return message.reply({ embeds: [createEmbed('❌ Missing Argument', `Usage: \`!${cmd} <server_id_or_name>\``, '#ff3333')] });
            const s = await findServer(args[0]);
            if (!s) return message.reply({ embeds: [createEmbed('❌ Error', 'Server not found.', '#ff3333')] });
            const db = loadDb();

            if (cmd === 'clouddelete') {
                await pteroReq('delete', `servers/${s.id}`);
                delete db[s.id]; saveDb(db);
                return message.reply({ embeds: [createEmbed('🗑️ Server Deleted', `Deleted **${s.name}**.`, '#00ff88')] });
            }
            if (cmd === 'suspend') {
                const hours = parseFloat(args[1]);
                if (!isNaN(hours)) {
                    db[s.id] = { ...db[s.id], serverId: s.id, serverName: s.name, suspendAt: Date.now() + (hours * 3600000), isSuspended: false };
                    saveDb(db);
                    return message.reply({ embeds: [createEmbed('⏰ Suspension Scheduled', `Scheduled in **${hours} hours**.`, '#ffa500')] });
                }
                await pteroReq('post', `servers/${s.id}/suspend`);
                db[s.id] = { ...db[s.id], isSuspended: true }; saveDb(db);
                return message.reply({ embeds: [createEmbed('🔴 Server Suspended', `Suspended **${s.name}**.`, '#ff3333')] });
            }
            if (cmd === 'unsuspend') {
                await pteroReq('post', `servers/${s.id}/unsuspend`);
                if (db[s.id]) { db[s.id].isSuspended = false; saveDb(db); }
                return message.reply({ embeds: [createEmbed('🟢 Server Unsuspended', `Unsuspended **${s.name}**.`, '#00ff88')] });
            }
            if (cmd === 'renew') {
                const days = parseFloat(args[1]);
                if (isNaN(days)) return message.reply({ embeds: [createEmbed('❌ Missing Days', 'Usage: `!renew <server> <days>`', '#ff3333')] });
                const newExpiry = ((db[s.id]?.suspendAt > Date.now()) ? db[s.id].suspendAt : Date.now()) + (days * 86400000);
                db[s.id] = { ...db[s.id], suspendAt: newExpiry, isSuspended: false }; saveDb(db);
                if (s.suspended) await pteroReq('post', `servers/${s.id}/unsuspend`).catch(() => {});
                return message.reply({ embeds: [createEmbed('🔄 Server Renewed', `Extended by **${days} days**.`, '#00ff88')] });
            }
        }

        if (cmd === 'cloudcreate') {
            // !cloudcreate <name> <user> <plan: free|creator|paid> <ramGB> <diskGB> <cpu%>
            if (args.length < 6) return message.reply({ embeds: [createEmbed('❌ Invalid Syntax', 'Usage: `!cloudcreate <name> <user> <free|creator|paid> <ramGB> <diskGB> <cpu>`', '#ff3333')] });
            const [name, userQuery, plan, ramStr, diskStr, cpuStr] = args;
            const ramGB = parseFloat(ramStr), diskGB = parseFloat(diskStr), cpu = parseInt(cpuStr);
            const u = await findUser(userQuery);
            if (!u) return message.reply({ embeds: [createEmbed('❌ Error', `User **${userQuery}** not found on panel!`, '#ff3333')] });

            const allocationId = await getUnassignedAllocation(CONFIG.DEFAULT_NODE_ID);
            const eggEnv = await getEggEnvironment(CONFIG.DEFAULT_NEST_ID, CONFIG.DEFAULT_EGG_ID);
            const planDays = plan === 'free' ? 7 : 30;

            const res = await pteroReq('post', 'servers', {
                name, user: u.id, nest: CONFIG.DEFAULT_NEST_ID, egg: CONFIG.DEFAULT_EGG_ID, docker_image: 'ghcr.io/pterodactyl/yolks:java_17',
                startup: 'java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar {{SERVER_JARFILE}}',
                limits: { memory: Math.round(ramGB * 1024), swap: 0, disk: Math.round(diskGB * 1024), io: 500, cpu },
                feature_limits: { databases: 1, allocations: 1, backups: 1 }, environment: eggEnv, allocation: { default: allocationId }
            });

            const suspendAt = Date.now() + (planDays * 86400000);
            const db = loadDb();
            db[res.attributes.id] = { serverId: res.attributes.id, serverName: name, suspendAt, isSuspended: false };
            saveDb(db);

            await sendLog(client, '📦 Log: Server Created', [{ name: 'Name', value: name, inline: true }, { name: 'Owner', value: u.username, inline: true }], '#00ff88');
            return message.reply({ embeds: [createEmbed('📦 Server Created', null, '#00ff88', [{ name: 'Server Name', value: name, inline: true }, { name: 'Expiry', value: `${planDays} Days`, inline: true }])] });
        }

        if (cmd === 'usercreate') {
            // !usercreate <email> <username> [firstname] [lastname]
            if (args.length < 2) return message.reply({ embeds: [createEmbed('❌ Invalid Syntax', 'Usage: `!usercreate <email> <username> [firstname] [lastname]`', '#ff3333')] });
            const [email, username, first_name = 'Cloud', last_name = 'User'] = args;
            const res = await pteroReq('post', 'users', { email, username, first_name, last_name });
            return message.reply({ embeds: [createEmbed('👤 User Created', `User **${res.attributes.username}** created! (\`ID: ${res.attributes.id}\`)`, '#00ff88')] });
        }

        if (cmd === 'userdelete') {
            if (!args[0]) return message.reply({ embeds: [createEmbed('❌ Invalid Syntax', 'Usage: `!userdelete <user_id_or_email>`', '#ff3333')] });
            const u = await findUser(args[0]);
            if (!u) return message.reply({ embeds: [createEmbed('❌ Error', 'User not found.', '#ff3333')] });
            await pteroReq('delete', `users/${u.id}`);
            return message.reply({ embeds: [createEmbed('🗑️ User Deleted', `Deleted user **${u.username}**.`, '#00ff88')] });
        }

    } catch (err) { return message.reply({ embeds: [createEmbed('❌ Command Error', err.message, '#ff3333')] }); }
});

client.on('interactionCreate', async i => {
    try {
        // 1. Select Menu Handler (Ticket Category)
        if (i.isStringSelectMenu() && i.customId === 'ticket_select_menu') {
            const catType = i.values[0];
            const modal = new ModalBuilder().setCustomId(`ticket_modal_${catType}`).setTitle('CloudCastle Support Request');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ticket_reason').setLabel('Reason / Short Title').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ticket_description').setLabel('Describe your request').setStyle(TextInputStyle.Paragraph).setRequired(true))
            );
            return await i.showModal(modal);
        }

        // 2. Modal Submission Handler
        if (i.isModalSubmit() && i.customId.startsWith('ticket_modal_')) {
            await i.deferReply({ ephemeral: true });
            const catRaw = i.customId.replace('ticket_modal_', '');
            const categoryFormatted = catRaw.replace('_', ' ').toUpperCase();
            const reason = i.fields.getTextInputValue('ticket_reason');
            const description = i.fields.getTextInputValue('ticket_description');
            
            const targetCategoryId = CONFIG.CATEGORIES[catRaw] || null;
            const cleanUser = i.user.username.toLowerCase().replace(/[^a-z0-9]/g, '');

            const ticketChannel = await i.guild.channels.create({
                name: 'need-staff-reply', 
                type: ChannelType.GuildText, 
                parent: targetCategoryId,
                topic: `OpenerId:${i.user.id}|OpenerUser:${cleanUser}`,
                permissionOverwrites: [
                    { id: i.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: i.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                    ...(CONFIG.CLOUDTEAM_ROLE_ID ? [{ id: CONFIG.CLOUDTEAM_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }] : [])
                ]
            });

            const detailsEmbed = new EmbedBuilder().setColor('#00d2ff').setTitle('📝 Ticket Details').addFields({ name: '👤 Opener', value: `${i.user}`, inline: true }, { name: '📂 Category', value: categoryFormatted, inline: true }, { name: '📌 Reason', value: reason, inline: false }, { name: '💬 Description', value: description, inline: false }).setFooter({ text: `Ticket System | CloudCastle • ${fmtIST()}` });

            await ticketChannel.send({ content: `<@&${CONFIG.CLOUDTEAM_ROLE_ID}> ${i.user}`, embeds: [detailsEmbed], components: getTicketActionRow(false) });
            return await i.editReply({ embeds: [createEmbed('✅ Ticket Created', `Your ticket channel: ${ticketChannel}`, '#00ff88')] });
        }

        // 3. User Select Menu Handler
        if (i.isUserSelectMenu()) {
            await i.deferReply({ ephemeral: true });
            if (i.customId === 'add_user_select') {
                const targetUserId = i.values[0];
                await i.channel.permissionOverwrites.edit(targetUserId, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
                await i.channel.send({ embeds: [createEmbed('➕ User Added', `<@${targetUserId}> has been added to the ticket by ${i.user}.`, '#00ff88')] });
                return await i.editReply({ embeds: [createEmbed('✅ Success', `<@${targetUserId}> has been granted access.`, '#00ff88')] });
            }
            if (i.customId === 'remove_user_select') {
                const targetUserId = i.values[0];
                await i.channel.permissionOverwrites.delete(targetUserId).catch(() => {});
                await i.channel.send({ embeds: [createEmbed('➖ User Removed', `<@${targetUserId}> has been removed from the ticket by ${i.user}.`, '#ff3333')] });
                return await i.editReply({ embeds: [createEmbed('✅ Success', `<@${targetUserId}>'s access has been revoked.`, '#00ff88')] });
            }
        }

        // 4. Button Handler
        if (i.isButton()) {
            if (i.customId === 'close_ticket') {
                await i.deferReply({ ephemeral: true });
                if (!isAuth(i.member)) return await i.editReply({ embeds: [createEmbed('❌ Staff Only', 'Only CloudTeam staff can close tickets.', '#ff3333')] });
                await handleTicketClose(i.channel, i.user, i.guild);
                return await i.editReply({ embeds: [createEmbed('🔒 Ticket Closed', 'Moved to closed status.', '#ffa500')] });
            }

            if (i.customId === 'reopen_ticket_btn') {
                await i.deferReply({ ephemeral: true });
                if (!isAuth(i.member)) return await i.editReply({ embeds: [createEmbed('❌ Staff Only', 'Only CloudTeam staff can close tickets.', '#ff3333')] });
                await handleTicketClose(i.channel, i.user, i.guild);
                return await i.editReply({ embeds: [createEmbed('🔒 Ticket Closed', 'Moved to closed status.', '#ffa500')] });
            }

            if (i.customId === 'reopen_ticket_btn') {
                await i.deferReply({ ephemeral: true });
                if (!isAuth(i.member)) return await i.editReply({ embeds: [createEmbed('❌ Staff Only', 'Only staff can reopen tickets.', '#ff3333')] });
                await handleTicketReopen(i.channel, i.user, i.guild, i.member);
                return await i.editReply({ embeds: [createEmbed('🔓 Ticket Reopened', 'Ticket reopened.', '#00ff88')] });
            }

            if (i.customId === 'delete_ticket_btn') {
                await i.deferReply({ ephemeral: true });
                if (!isAuth(i.member)) return await i.editReply({ embeds: [createEmbed('❌ Staff Only', 'Only staff can delete tickets.', '#ff3333')] });
                await i.editReply({ embeds: [createEmbed('🗑️ Deleting Ticket', 'Channel will be deleted in 5 seconds...', '#ff3333')] });
                setTimeout(() => i.channel.delete().catch(() => {}), 5000);
                return;
            }

            if (i.customId === 'claim_ticket') {
                await i.deferReply({ ephemeral: true });
                if (!isAuth(i.member)) return await i.editReply({ embeds: [createEmbed('❌ Staff Only', 'Only staff can claim tickets.', '#ff3333')] });
                const topic = i.channel.topic || '';
                if (topic.includes('ClaimedBy:')) return await i.editReply({ embeds: [createEmbed('❌ Already Claimed', `Already claimed!`, '#ff3333')] });
                await i.channel.setTopic(`${topic}|ClaimedBy:${i.user.id}`).catch(() => {});
                await i.channel.send({ embeds: [createEmbed('🫴🏻 Ticket Claimed', `Ticket claimed by ${i.user}`, '#00ff88')] });
                return await i.editReply({ embeds: [createEmbed('✅ Success', 'You claimed this ticket.', '#00ff88')] });
            }

            if (i.customId === 'unclaim_ticket') {
                await i.deferReply({ ephemeral: true });
                if (!isAuth(i.member)) return await i.editReply({ embeds: [createEmbed('❌ Staff Only', 'Only staff can unclaim tickets.', '#ff3333')] });
                const topic = i.channel.topic || '';
                if (!topic.includes('ClaimedBy:')) return await i.editReply({ embeds: [createEmbed('❌ Error', 'Not claimed by anyone!', '#ff3333')] });
                const claimedId = topic.split('ClaimedBy:')[1]?.split('|')[0]?.trim();
                if (claimedId !== i.user.id) return await i.editReply({ embeds: [createEmbed('❌ Permission Denied', `Only <@${claimedId}> can unclaim it.`, '#ff3333')] });
                const newTopic = topic.replace(/\|?ClaimedBy:\d+/, '');
                await i.channel.setTopic(newTopic).catch(() => {});
                await i.channel.send({ embeds: [createEmbed('🔓 Ticket Unclaimed', `Ticket unclaimed by ${i.user}`, '#ffa500')] });
                return await i.editReply({ embeds: [createEmbed('✅ Success', 'Ticket unclaimed.', '#00ff88')] });
            }

            if (i.customId === 'add_user_btn') {
                const userSelect = new UserSelectMenuBuilder().setCustomId('add_user_select').setPlaceholder('Select a user to ADD to this ticket').setMaxValues(1);
                return await i.reply({ content: '**Add User to Ticket:**\nSelect a user below to grant them access.', components: [new ActionRowBuilder().addComponents(userSelect)], ephemeral: true });
            }

            if (i.customId === 'remove_user_btn') {
                const userSelect = new UserSelectMenuBuilder().setCustomId('remove_user_select').setPlaceholder('Select a user to REMOVE from this ticket').setMaxValues(1);
                return await i.reply({ content: '**Remove User from Ticket:**\nSelect a user below to revoke their access.', components: [new ActionRowBuilder().addComponents(userSelect)], ephemeral: true });
            }
        }

        // 5. Slash Commands Handler
        if (i.isChatInputCommand()) {
            const { commandName: cmd, options, member, user, guild, channel } = i;

            if (cmd === 'help') return i.reply({ embeds: [helpEmbed], ephemeral: true });
            if (cmd === 'ping') return i.reply({ embeds: [createEmbed(`${CONFIG.EMOJIS.ping} Latency Check`, `API Latency: **${client.ws.ping}ms**`, '#00d2ff')], ephemeral: true });
            if (cmd === 'status') {
                await i.deferReply({ ephemeral: true });
                const nodesRes = await pteroReq('get', 'nodes').catch(() => null);
                return i.editReply({ embeds: [createEmbed('🖥️ System Status', `Panel API: ${nodesRes ? CONFIG.EMOJIS.online + ' Online' : CONFIG.EMOJIS.offline + ' Offline'}\nBot Latency: **${client.ws.ping}ms**`, nodesRes ? '#00ff88' : '#ff3333')] });
            }

            if (!isAuth(member)) return i.reply({ embeds: [createEmbed('❌ Access Denied', 'You do not have permission to execute this command.', '#ff3333')], ephemeral: true });

            if (cmd === 'ticket' || cmd === 'setup-ticket') {
                const sub = cmd === 'setup-ticket' ? 'setup' : options.getSubcommand();
                if (sub === 'setup') {
                    await channel.send({ embeds: [buildTicketPanelEmbed()], components: [new ActionRowBuilder().addComponents(getTicketDropdown())] });
                    return i.reply({ embeds: [createEmbed('✅ Success', 'Ticket portal deployed!', '#00ff88')], ephemeral: true });
                }
                if (sub === 'reopen') {
                    await i.deferReply({ ephemeral: true });
                    await handleTicketReopen(channel, user, guild, member);
                    return i.editReply({ embeds: [createEmbed('🔓 Ticket Reopened', 'Ticket moved back to active support.', '#00ff88')] });
                }
                if (sub === 'close') {
                    await i.deferReply({ ephemeral: true });
                    await handleTicketClose(channel, user, guild);
                    return i.editReply({ embeds: [createEmbed('🔒 Ticket Closed', 'Ticket marked as closed.', '#ffa500')] });
                }
                if (sub === 'claim') {
                    const topic = channel.topic || '';
                    if (topic.includes('ClaimedBy:')) return i.reply({ embeds: [createEmbed('❌ Already Claimed', `This ticket is already claimed!`, '#ff3333')], ephemeral: true });
                    await channel.setTopic(`${topic}|ClaimedBy:${user.id}`).catch(() => {});
                    return i.reply({ embeds: [createEmbed('🫴🏻 Ticket Claimed', `Ticket claimed by ${user}`, '#00ff88')] });
                }
                if (sub === 'unclaim') {
                    const topic = channel.topic || '';
                    if (!topic.includes('ClaimedBy:')) return i.reply({ embeds: [createEmbed('❌ Error', 'Ticket is not claimed!', '#ff3333')], ephemeral: true });
                    const claimedId = topic.split('ClaimedBy:')[1]?.split('|')[0]?.trim();
                    if (claimedId !== user.id) return i.reply({ embeds: [createEmbed('❌ Permission Denied', `Only <@${claimedId}> can unclaim it.`, '#ff3333')], ephemeral: true });
                    const newTopic = topic.replace(/\|?ClaimedBy:\d+/, '');
                    await channel.setTopic(newTopic).catch(() => {});
                    return i.reply({ embeds: [createEmbed('🔓 Ticket Unclaimed', `Ticket unclaimed by ${user}`, '#ffa500')] });
                }
                if (sub === 'add') {
                    const targetUser = options.getUser('user');
                    await channel.permissionOverwrites.edit(targetUser.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
                    return i.reply({ embeds: [createEmbed('➕ User Added', `${targetUser} added to ticket.`, '#00ff88')] });
                }
                if (sub === 'remove') {
                    const targetUser = options.getUser('user');
                    await channel.permissionOverwrites.delete(targetUser.id);
                    return i.reply({ embeds: [createEmbed('➖ User Removed', `${targetUser} removed from ticket.`, '#ff3333')] });
                }
            }

            if (cmd === 'list') {
                await i.deferReply({ ephemeral: true });
                const res = await pteroReq('get', 'servers?per_page=50');
                const servers = res.data.map(s => `• **${s.attributes.name}** (\`ID: ${s.attributes.id}\`)`).join('\n') || 'No servers found.';
                return i.editReply({ embeds: [createEmbed('🖥️ Panel Server List', servers, '#00d2ff')] });
            }

            if (cmd === 'suspended') {
                await i.deferReply({ ephemeral: true });
                const res = await pteroReq('get', 'servers?per_page=50');
                const suspendedServers = res.data.filter(s => s.attributes.suspended).map(s => `• **${s.attributes.name}** (\`ID: ${s.attributes.id}\`)`).join('\n') || 'No suspended servers found.';
                return i.editReply({ embeds: [createEmbed('🔴 Suspended Servers List', suspendedServers, '#ff3333')] });
            }

            if (cmd === 'usercreate') {
                await i.deferReply({ ephemeral: true });
                const email = options.getString('email'), username = options.getString('username');
                const first_name = options.getString('firstname') || 'Cloud', last_name = options.getString('lastname') || 'User';
                const res = await pteroReq('post', 'users', { email, username, first_name, last_name });
                return i.editReply({ embeds: [createEmbed('👤 User Created', `User **${res.attributes.username}** created! (\`ID: ${res.attributes.id}\`)`, '#00ff88')] });
            }

            if (cmd === 'userdelete') {
                await i.deferReply({ ephemeral: true });
                const u = await findUser(options.getString('user'));
                if (!u) return i.editReply({ embeds: [createEmbed('❌ Error', 'User not found.', '#ff3333')] });
                await pteroReq('delete', `users/${u.id}`);
                return i.editReply({ embeds: [createEmbed('🗑️ User Deleted', `Deleted user **${u.username}**.`, '#00ff88')] });
            }

            if (cmd === 'cloudcreate') {
                await i.deferReply({ ephemeral: true });
                const name = options.getString('name'), userQuery = options.getString('user'), plan = options.getString('plan'), ramGB = options.getNumber('ram'), diskGB = options.getNumber('disk'), cpu = options.getInteger('cpu');
                const u = await findUser(userQuery);
                if (!u) return i.editReply({ embeds: [createEmbed('❌ Error', `User **${userQuery}** not found on panel!`, '#ff3333')] });
                
                const allocationId = await getUnassignedAllocation(CONFIG.DEFAULT_NODE_ID);
                const eggEnv = await getEggEnvironment(CONFIG.DEFAULT_NEST_ID, CONFIG.DEFAULT_EGG_ID);
                const planDays = plan === 'free' ? 7 : 30;

                const res = await pteroReq('post', 'servers', {
                    name, user: u.id, nest: CONFIG.DEFAULT_NEST_ID, egg: CONFIG.DEFAULT_EGG_ID, docker_image: 'ghcr.io/pterodactyl/yolks:java_17',
                    startup: 'java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar {{SERVER_JARFILE}}',
                    limits: { memory: Math.round(ramGB * 1024), swap: 0, disk: Math.round(diskGB * 1024), io: 500, cpu },
                    feature_limits: { databases: 1, allocations: 1, backups: 1 }, environment: eggEnv, allocation: { default: allocationId }
                });

                const suspendAt = Date.now() + (planDays * 86400000);
                const db = loadDb();
                db[res.attributes.id] = { serverId: res.attributes.id, serverName: name, suspendAt, isSuspended: false };
                saveDb(db);

                await sendLog(client, '📦 Log: Server Created', [{ name: 'Name', value: name, inline: true }, { name: 'Owner', value: u.username, inline: true }], '#00ff88');
                return i.editReply({ embeds: [createEmbed('📦 Server Created', null, '#00ff88', [{ name: 'Server Name', value: name, inline: true }, { name: 'Expiry', value: `${planDays} Days`, inline: true }])] });
            }

            if (cmd === 'clouddelete' || cmd === 'suspend' || cmd === 'unsuspend' || cmd === 'renew') {
                await i.deferReply({ ephemeral: true });
                const s = await findServer(options.getString('server'));
                if (!s) return i.editReply({ embeds: [createEmbed('❌ Error', 'Server not found.', '#ff3333')] });
                const db = loadDb();

                if (cmd === 'clouddelete') {
                    await pteroReq('delete', `servers/${s.id}`);
                    delete db[s.id]; saveDb(db);
                    return i.editReply({ embeds: [createEmbed('🗑️ Server Deleted', `Deleted **${s.name}**.`, '#00ff88')] });
                }
                if (cmd === 'suspend') {
                    const hours = options.getNumber('hours');
                    if (hours) {
                        db[s.id] = { ...db[s.id], serverId: s.id, serverName: s.name, suspendAt: Date.now() + (hours * 3600000), isSuspended: false };
                        saveDb(db);
                        return i.editReply({ embeds: [createEmbed('⏰ Suspended Scheduled', `Suspension in **${hours} hours**.`, '#ffa500')] });
                    }
                    await pteroReq('post', `servers/${s.id}/suspend`);
                    db[s.id] = { ...db[s.id], isSuspended: true }; saveDb(db);
                    return i.editReply({ embeds: [createEmbed('🔴 Server Suspended', `Suspended **${s.name}**.`, '#ff3333')] });
                }
                if (cmd === 'unsuspend') {
                    await pteroReq('post', `servers/${s.id}/unsuspend`);
                    if (db[s.id]) { db[s.id].isSuspended = false; saveDb(db); }
                    return i.editReply({ embeds: [createEmbed('🟢 Server Unsuspended', `Unsuspended **${s.name}**.`, '#00ff88')] });
                }
                if (cmd === 'renew') {
                    const days = options.getNumber('days');
                    const newExpiry = ((db[s.id]?.suspendAt > Date.now()) ? db[s.id].suspendAt : Date.now()) + (days * 86400000);
                    db[s.id] = { ...db[s.id], suspendAt: newExpiry, isSuspended: false }; saveDb(db);
                    if (s.suspended) await pteroReq('post', `servers/${s.id}/unsuspend`).catch(() => {});
                    return i.editReply({ embeds: [createEmbed('🔄 Server Renewed', `Extended by **${days} days**.`, '#00ff88')] });
                }
            }
        }
    } catch (e) {
        console.error('Interaction Error:', e);
        const errEmb = createEmbed('❌ Error', e.message || 'An error occurred.', '#ff3333');
        if (i.deferred || i.replied) await i.editReply({ embeds: [errEmb] }).catch(() => {});
        else await i.reply({ embeds: [errEmb], ephemeral: true }).catch(() => {});
    }
});

client.login(process.env.DISCORD_TOKEN);