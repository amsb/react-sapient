# react-sapient
React Web APIs for Humans

## Introduction

Simply take the cruft out of your simple CRUD app. The react-sapient library uses the React 16.6+ `Suspense` feature to create a simple way of working with simple CRUD-style Web APIs.

> **WARNING**: This library uses [`Suspense`](https://reactjs.org/docs/code-splitting.html#suspense) in a way that might not *yet* be officially sanctioned (but will be), uses `React.Context` `Consumer`'s `unstable_observedBits` internally, and could end up not adding much over `react-cache` when the React team fully realizes their vision for it. Until then, I've found this to be a pain-free way of doing simple CRUD work!

### Step 1: Create API

The remote resources your application will read, update, create, post, and delete are declared with `createApi` along with the methods for operating on those remote resources. You can create the API in a separate `api.js` module for later importing into various parts of your application. Here is an example of creating a `Article` resource that the application can read and update:

```javascript
import { createApi } from "react-sapient";

const BASE_URL = "https://jsonplaceholder.typicode.com"

const api = createApi({
  Article: {
    read: async articleId =>
      (await fetch(`${BASE_URL}/articles/${articleId}`)).json(),
    update: async (articleId, articleData) => {
      return (await fetch(`${BASE_URL}/articles/${articleId}`,
        {
          method: "PATCH",
          body: JSON.stringify(articleData),
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

### Step 2: Setup App
A single `Sapient` component and at least one [`Suspense`](https://reactjs.org/docs/code-splitting.html#suspense) component must be inserted above the first use of the API. You can insert one `Suspense` component at a high level for general fallback and insert others at lower levels to create fine grained loading placeholders.

```javascript
import React from "react";
import ReactDOM from "react-dom";
import { Sapient } from "react-sapient";

function App() {
  return (
    <Sapient>
      <React.Suspense fallback={<p>Loading...</p>}>
          <ArticleView articleId={1} />
      </React.Suspense>
    </Sapient>
  );
}
```

### Step 3: Use API
Once the API is created and the application has been setup, the remote resources can be simply accessed and interacted with through an easy to use hook for each resource/endpoint:

```javascript
function ArticleView({ articleId }) {
  const [article, { updateArticle }] = api.useArticle(articleId);
  return <Article article={article} updateArticle={updateArticle} />;
}

const Article = React.memo(({ article, updateArticle }) => (
  <>
    <h1>{article.title}</h1>
    <h2>{article.body}</h2>
    <button
      onClick={() => updateArticle({ title: "New Title", body: "New Content" })}
    >
      Update
    </button>
  </>
));
```

## API Methods
The call signature is `(data, actions)` where the actions can be:

* `delete{Endpoint}()`
* `update{Endpoint}(updatedData) => updatedData`
* `create{Endpoint}(newData)` => (createdId, createdData)`
* `post{Endpoint}(postData)` => responseData`

with `{Endpoint}` being replaced with the name of your endpoint (`Article` in this example).

### Invalidation
If updating one resource invalidates another resource, you can use the optional `invalidate` argument to a resource handler as demonstrated in the below example.

```javascript
const api = createApi({
  Articles: {
    read: async () => (await fetch(`${BASE_URL}/articles`)).json()
  },
  Article: {
    read: async articleId => (await fetch(`${BASE_URL}/articles/${articleId}`)).json(),
    update: async (articleId, articleData, invalidate) => {
      const data = (await fetch(`${BASE_URL}/articles/${articleId}`, {
        method: "PATCH",
        body: JSON.stringify(articleData),
        headers: {
          "Content-type": "application/json; charset=UTF-8"
        }
      })).json();
      invalidate("Articles");
      return data;
    }
  }
});
```

### Example
Here's a complete example of how you might define all the different methods:

```javascript
const api = createApi({
  Resources: {
    // fetch list of resources
    read: async () => (await fetch(`${BASE_URL}/resources`)).json()
  },
  Resource: {
    // fetch a resource
    read: async resourceId => (
      await fetch(`${BASE_URL}/resources/${resourceId}`)
    ).json(),
    // create a new resource
    create: async (resourceData, invalidate) => {
      const newResource = (await fetch(`${BASE_URL}/resources/${resourceId}`, {
        method: "POST",
        body: JSON.stringify(resourceData),
        headers: {
          "Content-type": "application/json; charset=UTF-8"
        }
      })).json();
      invalidate("Resources"); // invalidated resource list
      return [newResource["id"], newResource];
    },
    // update an existing resource
    update: async (resourceId, resourceData, invalidate) => {
      const data = (await fetch(`${BASE_URL}/resources/${resourceId}`, {
        method: "PATCH",
        body: JSON.stringify(resourceData),
        headers: {
          "Content-type": "application/json; charset=UTF-8"
        }
      })).json();
      invalidate("Resources"); // invalidated resource list
      return data;
    }
  },
  Subscription:
    // subscribe to resource notifications
    post: async ({resourceId, email}, invalidate) => {
      const responseData = (await fetch(`${BASE_URL}/resources/${resourceId}/subscribe`, {
        method: "POST",
        body: JSON.stringify({email}),
        headers: {
          "Content-type": "application/json; charset=UTF-8"
        }
      })).json();
      return responseData;
    }
  }
});
```

### Returning Data
Both the `create` and `post` method will return a promise for the data to the original caller. The `create` method will return the newly created `id`, while the `post` method will return the entire "response" data.

Here's an example of how you might capture the newly created `id` to update the application state:

```javascript
<button
  onClick={async () => {
    const articleId = await createArticle(
      {title: "Untitled", body: ""}
    )
    setArticleId(articleId)
  }
>
```

Here's an example of you might use the `post` method to subscribe to notifications and handle an error in a post request:

```javascript
<button
  onClick={async () => {
    try {
      const result = await postSubscription({email})
      setMessage({type: "success", message: "You are subscribed!"})
    } catch (error) {
      setMessage(type: "error", message: `${error}: could not subscribe`)
    }
  }
>
```

## Not Using Hooks?
The remote resources can also be accessed through an easy to use function-as-a-child component that calls the component's child using the render prop pattern:

```javascript
function ArticleView({ articleId }) {
  return (
    <api.UseArticle id={articleId}>
      {(article, { updateArticle }) => (
        <Article article={article} updateArticle={updateArticle} />
      )}
    </api.UseArticle>
  );
}

const Article = React.memo(({ article, updateArticle }) => (
  <>
    <h1>{article.title}</h1>
    <h2>{article.body}</h2>
    <button
      onClick={() => updateArticle({ title: "New Title", body: "New Content" })}
    >
      Update
    </button>
  </>
));
```
