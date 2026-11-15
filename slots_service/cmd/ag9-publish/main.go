// ag9-publish replays math candidates and saves a new immutable local release.
package main

import (
	"aislots/slots_service/internal/games/ag9"
	"flag"
	"fmt"
	"os"
)

func main() {
	config := flag.String("config", "", "AG9 math configuration directory")
	base := flag.String("base", "", "ordinary candidate directory")
	free := flag.String("free", "", "special candidate directory")
	out := flag.String("out", "", "new immutable release directory")
	flag.Parse()
	if *config == "" || *base == "" || *free == "" || *out == "" {
		fmt.Fprintln(os.Stderr, "-config, -base, -free and -out are required")
		os.Exit(1)
	}
	if err := ag9.Publish(*config, *base, *free, *out); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	fmt.Println("AG9 local release validated:", *out)
}
