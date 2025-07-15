package main

import (
	"bytes"
	"html/template"
	"io/fs"
	"log"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"time"

	"github.com/adrg/frontmatter"
	"github.com/yuin/goldmark"
)

type (
	D struct{ T template.HTML }
	M struct {
		Title    string    `yaml:"title"`
		Date     time.Time `yaml:"date"`
		Filename string
		T     []byte
	}
)

func main() {
	renderBlog()
	renderWritePage("s/t/base.html", "s/t/index.html", "index.html")
}

func renderWritePage(tmpl, f, out string) {
	b, e := os.ReadFile(f)
	if e != nil {
		log.Fatal("couldn't open file:" + f)
	}
	buf := renderData(tmpl, D{T: template.HTML(b)})
	os.WriteFile(out, buf.Bytes(), 0o644)
}

func renderBase(data []byte) bytes.Buffer {
	buf := renderData("s/t/base.html", D{T: template.HTML(data)})
	return buf
}

func renderData(tmpl string, data any) bytes.Buffer {
	t, e := template.ParseFiles(tmpl)
	if e != nil {
		log.Fatal("couldn't open template:" + tmpl)
	}
	var buf bytes.Buffer
	if e := t.Execute(&buf, data); e != nil {
		log.Fatal("couldn't execute template: " + tmpl)
	}
	return buf
}

func renderBlog() {
	t, e := template.ParseFiles("s/t/base.html")
	if e != nil {
		log.Fatal("couldn't open base template")
	}
	post, e := template.ParseFiles("s/t/post.html")
	if e != nil {
		log.Fatal("couldn't open post template")
	}
	var posts []M
	filepath.WalkDir("posts", func(p string, d fs.DirEntry, e error) error {
		if e != nil || d.IsDir() || !strings.HasSuffix(d.Name(), ".md") {
			return e
		}
		f, e := os.Open(p)
		if e != nil {
			return e
		}

		var meta M
		rest, e := frontmatter.Parse(f, &meta)
		if e != nil {
			return e
		}
		meta.Filename = strings.TrimSuffix(d.Name(), ".md")

		var buf, out bytes.Buffer
		if e := goldmark.Convert(rest, &buf); e != nil {
			return e
		}
		meta.T = buf.Bytes()
		posts = append(posts, meta)
		if e := post.Execute(&buf, meta); e != nil {
			return e
		}
		b := bytes.NewBuffer(bytes.TrimSpace(buf.Bytes()))

		if e := t.Execute(&out, D{T: template.HTML(b.Bytes())}); e != nil {
			return e
		}
		o := filepath.Join("posts", meta.Filename+".html")
		os.WriteFile(o, out.Bytes(), 0o644)

		return nil
	})
	slices.SortFunc(posts, func(a, b M) int { return a.Date.Compare(b.Date) })
	slices.Reverse(posts)
	renderedPosts := renderData("s/t/posts.html", posts)
	renderedPosts = renderBase(renderedPosts.Bytes())
	os.WriteFile("posts.html", renderedPosts.Bytes(), 0o644)
}
