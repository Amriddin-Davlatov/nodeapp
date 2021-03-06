'use strict';

const http = require('http');
const mysqlx = require('@mysql/xdevapi');

const port = process.env.PORT || 9999;
const statusOk = 200;
//const statusNoContent = 204;
const statusBadRequest = 400;
const statusNotFound = 404;
const statusInternalServerError = 500;
const schema = 'social';

const client = mysqlx.getClient({
    user: 'app',
    password: 'pass',
    host: '0.0.0.0',
    port: 33060
});
 
function sendResponse(response, {status = statusOk, headers = {}, body = null}) {
    Object.entries(headers).forEach(function([key, value]) {
        response.setHeader(key, value);
    });
    response.writeHead(status);
    response.end(body);
}

function sendJSON(response, body) {
    sendResponse(response, {
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });
}

function map(columns) {
    return row => row.reduce((res, value, i) => ({...res, [columns[i].getColumnLabel()]: value}), {});
}

const methods = new Map();
methods.set('/posts.get', async ({response, db}) => {
    const table = await db.getTable('posts');
    const result = await table.select(['id', 'content', 'likes', 'created'])
        .where('removed = :removed')
        .bind('removed', 0)
        .orderBy('id DESC')
        .execute();

    const data = result.fetchAll();
    result.getAffectedItemsCount();
    const columns = result.getColumns();
    const posts = data.map(map(columns));
    sendJSON(response, posts);
});
methods.set('/posts.getById', async ({response, searchParams, db}) => {
    const id = Number(searchParams.get('id'));

    if (!searchParams.has('id') || Number.isNaN(id)) {
        sendResponse(response, {status: statusBadRequest});
        return;
    }
    
    const table = await db.getTable('posts');
    const result = await table.select(['id', 'content', 'likes', 'created'])
        .where('id = :id && removed = 0')
        .bind('id', id)
        .execute();

    const data = result.fetchAll();
    result.getAffectedItemsCount();
    const columns = result.getColumns();
    let post = data.map(map(columns));
    post = post[0];
    if (post === undefined) {
        sendResponse(response, {status: statusNotFound});
        return;
    }
    sendJSON(response, post);
});
methods.set('/posts.post', async ({response, searchParams, db}) => {
    if (!searchParams.has('content')) {
        sendResponse(response, {status: statusBadRequest});
        return;
    }

    const content = searchParams.get('content');

    const table = await db.getTable('posts');
    const result = await table.insert('content').values(content).execute();

    const id = result.getAutoIncrementValue();
    const insertResult = await table.select(['id', 'content', 'likes', 'created'])
        .where('id = :id && removed = 0')
        .bind('id', id)
        .execute();

    const data = insertResult.fetchAll();
    insertResult.getAffectedItemsCount();
    const columns = insertResult.getColumns();
    let post = data.map(map(columns));
    post = post[0];
    if (post === undefined) {
        sendResponse(response, {status: statusNotFound});
        return;
    }
    sendJSON(response, post);
});
methods.set('/posts.edit', async ({response, searchParams, db}) => {
    const id = Number(searchParams.get('id'));
    if (!searchParams.has('id') || Number.isNaN(id) || !searchParams.has('content')) {
        sendResponse(response, {status: statusBadRequest});
        return;
    }

    const content = searchParams.get('content');
    const table = await db.getTable('posts');

    const result = await table.update()
        .set('content', content)
        .where('id = :id && removed = 0')
        .bind('id', id).execute();
    
    const updated = result.getAffectedItemsCount();
    if (updated === 0) {
        sendResponse(response, {status: statusNotFound});
        return;
    }
    const updatedResult = await table.select(['id', 'content', 'likes', 'created'])
        .where('id = :id && removed = 0')
        .bind('id', id)
        .execute();

    const data = updatedResult.fetchAll();
    updatedResult.getAffectedItemsCount();
    const columns = updatedResult.getColumns();
    let post = data.map(map(columns));
    post = post[0];
    if (post === undefined) {
        sendResponse(response, {status: statusNotFound});
        return;
    }
    sendJSON(response, post);
});
methods.set('/posts.delete', async ({response, searchParams, db}) => {
    const id = Number(searchParams.get('id'));

    if (!searchParams.has('id') || Number.isNaN(id)) {
        sendResponse(response, {status: statusBadRequest});
        return;
    }

    const table = await db.getTable('posts');
    const result = await table.update()
        .set('removed', true)
        .where('id = :id')
        .bind('id', id)
        .execute();
    const removed = result.getAffectedItemsCount();

    if (removed === 0) {
        sendResponse(response, {status: statusNotFound});
        return;
    }
    const deletedResult = await table.select(['id', 'content', 'likes', 'created'])
    .where('id = :id')
    .bind('id', id)
    .execute();

    const data = deletedResult.fetchAll();
    deletedResult.getAffectedItemsCount();
    const columns = deletedResult.getColumns();
    let post = data.map(map(columns));
    post = post[0];
    if (post === undefined) {
        sendResponse(response, {status: statusNotFound});
        return;
    }
    sendJSON(response, post);
});
methods.set('/posts.restore', async ({response, searchParams, db}) => {
    const id = Number(searchParams.get('id'));

    if (!searchParams.has('id') || Number.isNaN(id)) {
        sendResponse(response, {status: statusBadRequest});
        return;
    }

    const table = await db.getTable('posts');
    const result = await table.update()
        .set('removed', false)
        .where('id = :id && removed = 1')
        .bind('id', id)
        .execute();
    const restored = result.getAffectedItemsCount();

    if (restored === 0) {
        sendResponse(response, {status: statusNotFound});
        return;
    }
    const restoredResult = await table.select(['id', 'content', 'likes', 'created'])
    .where('id = :id')
    .bind('id', id)
    .execute();

    const data = restoredResult.fetchAll();
    restoredResult.getAffectedItemsCount();
    const columns = restoredResult.getColumns();
    let post = data.map(map(columns));
    post = post[0];
    if (post === undefined) {
        sendResponse(response, {status: statusNotFound});
        return;
    }
    sendJSON(response, post);
});

methods.set('/posts.like', async ({response, searchParams, db}) => {
    const id = Number(searchParams.get('id'));

    if (!searchParams.has('id') || Number.isNaN(id)) {
        sendResponse(response, {status: statusBadRequest});
        return;
    }

    const table = await db.getTable('posts');
    const getLikes = await table.select(['id', 'content', 'likes', 'created'])
        .where('id = :id && removed = 0')
        .bind('id', id)
        .execute();
    
    const dataL = getLikes.fetchAll();
    if (dataL.length === 0) {
        sendResponse(response, {status: statusNotFound});
        return;
    }
    getLikes.getAffectedItemsCount();
    const columnsL = getLikes.getColumns();
    let postL = dataL.map(map(columnsL));
    postL = postL[0];

    const result = await table.update()
        .set('likes', postL.likes + 1)
        .where('id = :id && removed = 0')
        .bind('id', id)
        .execute();
    
    const liked = result.getAffectedItemsCount();
    if (liked === 0) {
        sendResponse(response, {status: statusNotFound});
        return;
    }

    const likedResult = await table.select(['id', 'content', 'likes', 'created'])
    .where('id = :id')
    .bind('id', id)
    .execute();

    const data = likedResult.fetchAll();
    likedResult.getAffectedItemsCount();
    const columns = likedResult.getColumns();
    let post = data.map(map(columns));
    post = post[0];
    if (post === undefined) {
        sendResponse(response, {status: statusNotFound});
        return;
    }
    sendJSON(response, post);
});

methods.set('/posts.dislike', async ({response, searchParams, db}) => {
    const id = Number(searchParams.get('id'));

    if (!searchParams.has('id') || Number.isNaN(id)) {
        sendResponse(response, {status: statusBadRequest});
        return;
    }

    const table = await db.getTable('posts');
    const getLikes = await table.select(['id', 'content', 'likes', 'created'])
        .where('id = :id && removed = 0')
        .bind('id', id)
        .execute();
    
    const dataL = getLikes.fetchAll();
    if (dataL.length === 0) {
        sendResponse(response, {status: statusNotFound});
        return;
    }
    getLikes.getAffectedItemsCount();
    const columnsL = getLikes.getColumns();
    let postL = dataL.map(map(columnsL));
    postL = postL[0];

    const result = await table.update()
        .set('likes', postL.likes - 1)
        .where('id = :id && removed = 0')
        .bind('id', id)
        .execute();
    
    const liked = result.getAffectedItemsCount();
    if (liked === 0) {
        sendResponse(response, {status: statusNotFound});
        return;
    }

    const likedResult = await table.select(['id', 'content', 'likes', 'created'])
    .where('id = :id')
    .bind('id', id)
    .execute();

    const data = likedResult.fetchAll();
    likedResult.getAffectedItemsCount();
    const columns = likedResult.getColumns();
    let post = data.map(map(columns));
    post = post[0];
    if (post === undefined) {
        sendResponse(response, {status: statusNotFound});
        return;
    }
    sendJSON(response, post);
});

const server = http.createServer(async(request, response) => {
    const {pathname, searchParams} = new URL(request.url, `http://${request.headers.host}`);

    const method = methods.get(pathname);
    if (method === undefined) {
        sendResponse(response, {status: statusNotFound});
        return;
    }

    let session = null;
    try {
        session = await client.getSession();
        const db = await session.getSchema(schema);
    
        const params = {
            request,
            response,
            pathname,
            searchParams,
            db,
        };

        await method(params);
    } catch (e) {
        sendResponse(response, {status: statusInternalServerError});
    } finally {
        if (session !== null) {
            try {
                await session.close();
            } catch (e) {
                console.log(e);
            }
        }
    }
});

server.listen(port);