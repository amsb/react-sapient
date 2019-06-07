# react-sapient
React Web APIs for Humans

## Introduction

Simply take the cruft out of your simple CRUD app. The react-sapient library uses the React 16.6+ `Suspense` feature to create a simple way of working with simple CRUD-style Web APIs.

> **WARNING**: This library uses [`Suspense`](https://reactjs.org/docs/code-splitting.html#suspense) in a way that might not *yet* be officially sanctioned (but will be), uses `React.Context` `Consumer`'s `unstable_observedBits` internally, and could end up not adding much over `react-cache` when the React team fully realizes their vision for it. Until then, I've found this to be a pain-free way of doing simple CRUD work!

## Step 1: Create API

The remote resources your application will create, read, update, and delete are declared with `createApi` along with the methods for operating on those remote resources. You can create the API in a separate `api.js` module for later importing into various parts of your application. Here is an example of creating a `Post` resource that the application can read and update:

```javascript
import { createApi } from "react-sapient";

const BASE_URL = "https://jsonplaceholder.typicode.com"

const api = createApi({
  Post: {
    read: async postId =>
      (await fetch(`${BASE_URL}/posts/${postId}`)).json(),
    update: async (postId, postData) => {
      return (await fetch(`${BASE_URL}/posts/${postId}`,
        {
          method: "PATCH",
          body: JSON.stringify(postData),
          headers: {
            "Content-type": "application/json; charset=UTF-8"
          }
        }
      )).json()
    }
  }
});

export default api;
```

## Step 2: Setup App
A single `Sapient` component and at least one [`Suspense`](https://reactjs.org/docs/code-splitting.html#suspense) component must be inserted above the first use of the API. You can insert one `Suspense` component at a high level for general fallback and insert others at lower levels to create fine grained loading placeholders.

```javascript
import React from "react";
import ReactDOM from "react-dom";
import { Sapient } from "react-sapient";

function App() {
  return (
    <Sapient>
      <React.Suspense fallback={<p>Loading...</p>}>
          <PostView postId={1} />
      </React.Suspense>
    </Sapient>
  );
}
```

## Step 3: Use API
Once the API is created and the application has been setup, the remote resources can be simply accessed and interacted with through an easy to use hook for each resource/endpoint:

```javascript
function PostView({ postId }) {
  const [post, { updatePost }] = api.usePost(postId);
  return <PostItem post={post} updatePost={updatePost} />;
}

const PostItem = React.memo(({ post, updatePost }) => (
  <>
    <h1>{post.title}</h1>
    <h2>{post.body}</h2>
    <button
      onClick={() => updatePost({ title: "New Title", body: "New Content" })}
    >
      Update
    </button>
  </>
));
```

The call signature is `(data, actions)` where the actions can be:

* `delete{Endpoint}()`
* `update{Endpoint}(updatedData) => updatedData`
* `create{Endpoint}(newData)` => (createdId, createdData)`

with `{Endpoint}` being replaced with the name of your endpoint (`Post` in this example).

### Not Using Hooks?
The remote resources can also be accessed through an easy to use function-as-a-child component that calls the component's child using the render prop pattern:

```javascript
function PostView({ postId }) {
  return (
    <api.UsePost id={postId}>
      {(post, { updatePost }) => (
        <PostItem post={post} updatePost={updatePost} />
      )}
    </api.UsePost>
  );
}

const PostItem = React.memo(({ post, updatePost }) => (
  <>
    <h1>{post.title}</h1>
    <h2>{post.body}</h2>
    <button
      onClick={() => updatePost({ title: "New Title", body: "New Content" })}
    >
      Update
    </button>
  </>
));
```

## Invalidation
If updating one resource invalidates another resource, you can use the optional `invalidate` argument to a resource handler as demonstrated in the below example.

```javascript
const api = createApi({
  Posts: {
    read: async () => (await fetch(`${BASE_URL}/posts`)).json()
  },
  Post: {
    read: async postId => (await fetch(`${BASE_URL}/posts/${postId}`)).json(),
    update: async (postId, postData, invalidate) => {
      const data = (await fetch(`${BASE_URL}/posts/${postId}`, {
        method: "PATCH",
        body: JSON.stringify(postData),
        headers: {
          "Content-type": "application/json; charset=UTF-8"
        }
      })).json();
      invalidate("Posts");
      return data;
    }
  }
});
```
