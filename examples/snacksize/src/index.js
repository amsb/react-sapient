import React from "react"
import ReactDOM from "react-dom"
import { Sapient, createApi } from "react-sapient"

const BASE_URL = "https://jsonplaceholder.typicode.com"

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
      })).json()
      invalidate("Posts")
      return data
    }
  }
})

// function PostView({ postId }) {
//   return (
//     <api.UsePost id={postId}>
//       {(post, { updatePost }) => (
//         <PostItem post={post} updatePost={updatePost} />
//       )}
//     </api.UsePost>
//   );
// }

function PostView({ postId }) {
  const [post, { updatePost }] = api.usePost(postId)
  return <PostItem post={post} updatePost={updatePost} />
}

const PostItem = React.memo(({ post, updatePost }) => (
  <>
    <h1>{post.title}</h1>
    <h2>{post.body}</h2>
    <button
      onClick={async () =>
        console.log(await updatePost({ title: "New Title", body: "New Content" }))
      }
    >
      Update
    </button>
  </>
))

function App() {
  return (
    <Sapient>
      <React.Suspense fallback={<p>Loading...</p>}>
        <div className="App">
          <PostView postId={1} />
        </div>
      </React.Suspense>
    </Sapient>
  )
}

ReactDOM.render(<App />, document.getElementById("root"))
