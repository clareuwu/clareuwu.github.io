package main

import (
	"bytes"
	"html/template"
	"io/fs"
	"log"
	"os"
	"path/filepath"
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
	}
)

func main() {
	renderBlog()
	renderPage("index.html")
}

func renderPage(f string) {
	t, e := template.ParseFiles("s/t/base.html")
	if e != nil {
		log.Fatal("couldn't open base template")
	}
	b, e := os.ReadFile("s/t/" + f)
	if e != nil {
		log.Fatal("couldn't open " + f)
	}
	var buf bytes.Buffer
	if e := t.Execute(&buf, D{T: template.HTML(b)}); e != nil {
		log.Fatal("couldn't execute base tmpl + " + f)
	}
	os.WriteFile("s/"+f, buf.Bytes(), 0o644)
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
		posts = append(posts, meta)

		var buf, out bytes.Buffer
		if e := post.Execute(&buf, meta); e != nil {
			return e
		}
		if e := goldmark.Convert(rest, &buf); e != nil {
			return e
		}
		b := bytes.NewBuffer(bytes.TrimSpace(buf.Bytes()))

		if e := t.Execute(&out, D{T: template.HTML(b.Bytes())}); e != nil {
			return e
		}
		o := filepath.Join("s", meta.Filename+".html")
		os.WriteFile(o, out.Bytes(), 0o644)

		return nil
	})
}
