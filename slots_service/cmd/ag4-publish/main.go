// ag4-publish independently validates math candidates and creates a new local
// release. It never modifies existing releases or enables/deploys a game.
package main

import (
	"aislots/slots_service/internal/games/ag4"
	"flag"
	"fmt"
	"os"
)

func main() {
	config := flag.String("config", "", "AG4 math config directory")
	base := flag.String("base", "", "ordinary candidate directory")
	free := flag.String("respin", "", "respin candidate directory")
	out := flag.String("out", "", "new immutable output directory")
	flag.Parse()
	if *config == "" || *base == "" || *free == "" || *out == "" {
		fmt.Fprintln(os.Stderr, "-config, -base, -respin and -out are required")
		os.Exit(1)
	}
	if err := ag4.Publish(*config, *base, *free, *out); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	fmt.Println("AG4 local release validated:", *out)
}
